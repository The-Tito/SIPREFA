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
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import serial
import serial.tools.list_ports
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sensor_processor import SensorProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Estado global ────────────────────────────────────────────
fault_log: deque[dict] = deque(maxlen=100)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sensores = [SensorProcessor(i + 1) for i in range(3)]


# ── Modelos Pydantic ─────────────────────────────────────────
class SensorConfig(BaseModel):
    sensor_id: int          # 1, 2, 3 — o 0 para aplicar a todos
    cooldown: float | None = None
    freq_min: float | None = None
    freq_max: float | None = None
    threshold_factor: float | None = None
    manual_threshold: float | None = None   # valor absoluto; -1 = quitar umbral manual
    reset_baseline: bool = False


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


# ── Endpoint: listar puertos ─────────────────────────────────
@app.get("/ports")
def listar_puertos():
    puertos = [
        {"device": p.device, "description": p.description}
        for p in serial.tools.list_ports.comports()
    ]
    auto = detectar_puerto()
    return {"ports": puertos, "auto_detected": auto}


# ── Endpoint: obtener historial de fallas ────────────────────
@app.get("/faults")
def obtener_fallas():
    return {"faults": list(fault_log), "total": len(fault_log)}


# ── Endpoint: limpiar historial ──────────────────────────────
@app.delete("/faults")
def limpiar_fallas():
    fault_log.clear()
    return {"status": "cleared"}


# ── Endpoint: leer configuración actual ─────────────────────
@app.get("/config")
def get_config():
    result = []
    for s in sensores:
        result.append({
            "sensor_id": s.id,
            "cooldown": s.cooldown_seconds,
            "freq_min": s.freq_min_hz,
            "freq_max": s.freq_max_hz,
            "threshold_factor": getattr(s, '_threshold_factor', 3),
            "manual_threshold": s.manual_threshold,
        })
    return {"sensors": result}


# ── Endpoint: actualizar configuración ──────────────────────
@app.post("/config")
def set_config(cfg: SensorConfig):
    targets = (
        sensores
        if cfg.sensor_id == 0
        else [s for s in sensores if s.id == cfg.sensor_id]
    )

    if not targets:
        return {"status": "error", "message": f"Sensor {cfg.sensor_id} no encontrado"}

    for s in targets:
        s.set_config(
            cooldown=cfg.cooldown,
            freq_min=cfg.freq_min,
            freq_max=cfg.freq_max,
            threshold_factor=cfg.threshold_factor,
            manual_threshold=cfg.manual_threshold,
        )
        if cfg.reset_baseline:
            s.reset_baseline()

    return {
        "status": "ok",
        "applied_to": [s.id for s in targets],
        "config": {
            "cooldown": targets[0].cooldown_seconds,
            "freq_min": targets[0].freq_min_hz,
            "freq_max": targets[0].freq_max_hz,
            "threshold_factor": getattr(targets[0], '_threshold_factor', 3),
            "manual_threshold": targets[0].manual_threshold,
        },
    }


# ── Endpoint: apagar servidor ────────────────────────────────
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

    config = await websocket.receive_json()
    port = config.get("port") or detectar_puerto()

    if not port:
        await websocket.send_json({"error": "No se detectó el ESP32"})
        await websocket.close()
        return

    try:
        ser = serial.Serial(port, 115200, timeout=1)
        await websocket.send_json({"status": "connected", "port": port})

        loop = asyncio.get_running_loop()

        while True:
            line = await loop.run_in_executor(None, ser.readline)
            line = line.decode("utf-8", errors="ignore").strip()
            data = line.split(",")

            if len(data) > 0 and len(data) % 3 == 0:
                try:
                    nums = [float(v) for v in data]
                    num_sensors_received = len(nums) // 3
                    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]

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
                            # "fault" ahora = nueva captura a registrar
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


# ── Servir frontend estático ─────────────────────────────────
def resource_path(relative: str) -> str:
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)

static_dir = resource_path("static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")