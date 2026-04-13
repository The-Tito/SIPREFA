import asyncio
import base64
import io
import json
import logging
import os
import sys
from collections import deque
from datetime import datetime

import matplotlib
matplotlib.use("Agg")  # Sin ventana gráfica
import matplotlib.pyplot as plt
import serial
import serial.tools.list_ports
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sensor_processor import SensorProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Estado global ────────────────────────────────────────────
# deque(maxlen=100) descarta automáticamente el más antiguo, O(1)
fault_log: deque[dict] = deque(maxlen=100)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sensores = [SensorProcessor(i + 1) for i in range(3)]


# ── Función: generar captura como imagen base64 ─────────────
def generar_captura(sensor_id: int, signal: list, energy_history: list, threshold: float) -> str:
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 5))
    fig.suptitle(f"Falla detectada — Sensor {sensor_id}", fontsize=12)

    ax1.plot(signal, color="blue", linewidth=0.8)
    ax1.set_title("Señal (Eje X)")
    ax1.set_ylabel("Amplitud")

    ax2.plot(energy_history, color="red", linewidth=1.2)
    ax2.axhline(y=threshold, color="red", linestyle="--", alpha=0.7, label="Umbral")
    ax2.set_facecolor("#ffe6e6")
    ax2.set_title("Energía Wavelet")
    ax2.set_ylabel("Energía")
    ax2.legend(fontsize=8)

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format="png", dpi=100)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


# ── Detectar ESP32 automáticamente ──────────────────────────
def detectar_puerto() -> str | None:
    for p in serial.tools.list_ports.comports():
        desc = p.description.upper()
        if any(kw in desc for kw in ["CP210", "CH340", "UART", "ESP"]):
            return p.device
    return None


# ── Endpoint: listar puertos disponibles ────────────────────
@app.get("/ports")
def listar_puertos():
    puertos = [
        {"device": p.device, "description": p.description}
        for p in serial.tools.list_ports.comports()
    ]
    auto = detectar_puerto()
    return {"ports": puertos, "auto_detected": auto}


# ── Endpoint: obtener historial de fallas ───────────────────
@app.get("/faults")
def obtener_fallas():
    faults_list = list(fault_log)
    return {"faults": faults_list, "total": len(faults_list)}


# ── Endpoint: limpiar historial ─────────────────────────────
@app.delete("/faults")
def limpiar_fallas():
    fault_log.clear()
    return {"status": "cleared"}


# ── Endpoint: Apagar el servidor completamente ────────────────
@app.post("/shutdown")
def apagar_servidor():
    import threading
    def auto_kill():
        import time
        time.sleep(1)
        os._exit(0)
    threading.Thread(target=auto_kill).start()
    return {"status": "apagando"}


# ── WebSocket principal ──────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    # El cliente manda el puerto a usar
    config = await websocket.receive_json()
    port = config.get("port") or detectar_puerto()

    if not port:
        await websocket.send_json({"error": "No se detectó el ESP32"})
        await websocket.close()
        return

    try:
        ser = serial.Serial(port, 115200, timeout=1)
        await websocket.send_json({"status": "connected", "port": port})

        # get_running_loop() es la forma correcta en Python 3.10+
        loop = asyncio.get_running_loop()

        while True:
            # Lectura serial sin bloquear el event loop
            line = await loop.run_in_executor(None, ser.readline)
            line = line.decode("utf-8", errors="ignore").strip()
            data = line.split(",")

            if len(data) > 0 and len(data) % 3 == 0:
                try:
                    nums = [float(v) for v in data]
                    num_sensors_received = len(nums) // 3
                    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]

                    # Asegurar que tenemos suficientes objetos SensorProcessor (dinámico)
                    while len(sensores) < num_sensors_received:
                        sensores.append(SensorProcessor(len(sensores) + 1))

                    results = []
                    for i in range(num_sensors_received):
                        sensor = sensores[i]
                        sensor.add_data(nums[i*3], nums[i*3+1], nums[i*3+2])
                        result = sensor.process()
                        if result:
                            result["timestamp"] = timestamp
                            results.append(result)

                    if results:
                        for result in results:
                            if result.get("fault"):
                                captura = generar_captura(
                                    result["sensor_id"],
                                    result["signal_x"],
                                    result["energy_history"],
                                    result["threshold"]
                                )
                                entrada = {
                                    "id": len(fault_log) + 1,
                                    "sensor_id": result["sensor_id"],
                                    "timestamp": result["timestamp"],
                                    "energy": result["energy"],
                                    "threshold": result["threshold"],
                                    "image_b64": captura,
                                }
                                fault_log.append(entrada)

                                # Solo mandamos metadata por WS, NO la imagen base64
                                # (el frontend la obtiene via GET /faults)
                                result["fault_snapshot"] = {
                                    "id": entrada["id"],
                                    "timestamp": entrada["timestamp"],
                                }

                        await websocket.send_json({"sensors": results})

                except ValueError as e:
                    logger.warning("Error parseando datos seriales: %s | línea: %r", e, line)
                    continue

    except serial.SerialException as e:
        await websocket.send_json({"error": str(e)})
    except WebSocketDisconnect:
        pass
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()

# ── Detectar ruta correcta dentro del .exe ──────────────────
def resource_path(relative: str) -> str:
    """Funciona tanto en desarrollo como dentro del .exe de PyInstaller"""
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)

# ── Servir el frontend estático ──────────────────────────────
static_dir = resource_path("static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
