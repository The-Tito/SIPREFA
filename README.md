# SIPREFA — CNC Fault Detector

Sistema de detección de fallas en tiempo real para máquinas CNC, basado en **Análisis Wavelet** de vibraciones. El sistema procesa datos de sensores (acelerómetros) vía puerto serie y visualiza el estado del equipo en un dashboard moderno.

## 🚀 Características

- **Análisis Wavelet (DWT)**: Descompone señales en múltiples niveles para detectar transitorios de falla.
- **Detección Automática**: Calcula un umbral dinámico basado en un periodo de calibración (baseline).
- **Dashboard en Tiempo Real**: Visualización de señales (Amplitud vs Tiempo) y Energía acumulada.
- **Historial de Fallas**: Registro automático de eventos con capturas de pantalla de la señal en el momento exacto del error.
- **Portable**: Generación de un ejecutable `.exe` para Windows fácil de distribuir.

## 🛠️ Tecnologías

- **Backend**: Python 3.10+, FastAPI, PySerial, PyWavelets, Matplotlib.
- **Frontend**: React 19, Next.js 16, Tailwind CSS, Recharts, Lucide React.
- **Build**: PyInstaller (para el empaquetado del binario).

## 📥 Instalación

### Requisitos previos
- Python 3.10 o superior.
- Node.js 18 o superior.

### Pasos
1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu-usuario/SIPREFA.git
   cd SIPREFA
   ```
2. Configura el Backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Configura el Frontend:
   ```bash
   cd ../frontend
   npm install
   ```

## 💻 Uso en Desarrollo

1. Inicia el Backend:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```
2. Inicia el Frontend:
   ```bash
   cd frontend
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📦 Cómo generar el ejecutable (.exe)

Este proyecto incluye un script automatizado para generar el proyecto para Windows:

1. Asegúrate de estar en la raíz del proyecto.
2. Ejecuta el script de construcción:
   ```bash
   python build_exe.py
   ```
3. El archivo resultante estará en la carpeta `dist/CNC_FaultDetector.exe`.

---

© 2026 SIPREFA Project.
