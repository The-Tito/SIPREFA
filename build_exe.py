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
dist_mode = "--onedir"

# El separador de rutas en PyInstaller cambia según el SO
# Windows usa ';' y Mac/Linux usa ':'
sep = os.pathsep

comando = [
    sys.executable, "-m", "PyInstaller",
    dist_mode,
    "--console",
    "--noconfirm",
    "--name", "CNC_FaultDetector",
    "--paths", "backend",                # Ayuda a resolver 'import main'
    "--add-data", f"backend{sep}backend",
    "--add-data", f"frontend/out{sep}static",
    # Estrategia colectiva para paquetes complejos
    "--collect-all", "uvicorn",
    "--collect-all", "websockets",
    "--collect-all", "matplotlib",
    # Otros hidden imports necesarios
    "--hidden-import", "pywt",
    "launcher.py",
]

print(f"\nIniciando construcción del binario ({dist_mode})...")
subprocess.run(comando, check=True)
print(f"\nProceso completado. Busca el resultado en la carpeta 'dist/'")
