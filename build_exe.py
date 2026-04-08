import subprocess
import sys
import os

# 1. Build del frontend (Next.js)
print("📦 Generando export estático del frontend...")
npm_cmd = "npm run build"
try:
    if sys.platform == "win32":
        subprocess.run(npm_cmd, shell=True, cwd="frontend", check=True)
    else:
        subprocess.run(["npm", "run", "build"], cwd="frontend", check=True)
except Exception as e:
    print(f"Error al compilar el frontend: {e}")
    sys.exit(1)

# 2. Configuración de PyInstaller
# En Windows genera un archivo único .exe (--onefile)
# En Mac genera una carpeta .app (--onedir) por compatibilidad
dist_mode = "--onefile" if sys.platform == "win32" else "--onedir"

# El separador de rutas en PyInstaller cambia según el SO
# Windows usa ';' y Mac/Linux usa ':'
sep = os.pathsep

comando = [
    sys.executable, "-m", "PyInstaller",
    dist_mode,
    "--windowed",
    "--noconfirm",
    "--name", "CNC_FaultDetector",
    "--paths", "backend",                # Ayuda a resolver 'import main'
    "--add-data", f"backend{sep}backend",
    "--add-data", f"frontend/out{sep}static",
    # Solo hidden imports que PyInstaller suele fallar con uvicorn y pywt
    "--hidden-import", "pywt",
    "--hidden-import", "websockets",     # Necesario para el servidor WebSocket
    "--hidden-import", "uvicorn.logging",
    "--hidden-import", "uvicorn.loops",
    "--hidden-import", "uvicorn.loops.auto",
    "--hidden-import", "uvicorn.protocols",
    "--hidden-import", "uvicorn.protocols.http",
    "--hidden-import", "uvicorn.protocols.http.auto",
    "--hidden-import", "uvicorn.protocols.websockets",
    "--hidden-import", "uvicorn.protocols.websockets.auto",
    "--hidden-import", "uvicorn.lifespan",
    "--hidden-import", "uvicorn.lifespan.on",
    "launcher.py",
]

print(f"\nIniciando construcción del binario ({dist_mode})...")
subprocess.run(comando, check=True)
print(f"\nProceso completado. Busca el resultado en la carpeta 'dist/'")
