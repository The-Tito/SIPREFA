import subprocess
import threading
import time
import webbrowser
import sys
import os

PORT = 8000
URL = f"http://localhost:{PORT}"

def resource_path(relative: str) -> str:
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, relative)

import uvicorn

def iniciar_backend():
    backend_path = resource_path("backend")
    # Añadir el path del backend para que uvicorn pueda importar 'main'
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, log_level="error")

def esperar_y_abrir():
    """Espera que el servidor esté listo antes de abrir el browser"""
    import urllib.request
    for _ in range(20):  # Intenta 20 veces (10 segundos)
        try:
            urllib.request.urlopen(f"{URL}/ports")
            webbrowser.open(URL)
            return
        except Exception:
            time.sleep(0.5)
    # Si no levantó, abre de todos modos
    webbrowser.open(URL)

if __name__ == "__main__":
    print("🚀 Iniciando CNC Fault Detector...")
    threading.Thread(target=iniciar_backend, daemon=True).start()
    esperar_y_abrir()

    # Mantener el proceso vivo
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Sistema detenido.")