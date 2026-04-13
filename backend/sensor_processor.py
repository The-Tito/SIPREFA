import numpy as np
import pywt
from collections import deque
from scipy.signal import butter, filtfilt
import time

WINDOW_SIZE = 512
THRESHOLD_FACTOR = 3
SAMPLE_RATE = 100  # Hz — ESP32 envía cada 10ms


class SensorProcessor:
    def __init__(self, sensor_id: int):
        self.id = sensor_id
        self.buffers = {
            'x': deque(maxlen=WINDOW_SIZE),
            'y': deque(maxlen=WINDOW_SIZE),
            'z': deque(maxlen=WINDOW_SIZE)
        }
        self.energy_history = deque(maxlen=100)
        self.baseline_energy: list[float] = []
        self.baseline_ready = False
        self.total_fallas = 0

        # ── Anti-spam: cooldown entre capturas ───────────────────────────────
        # Solo se registra una falla nueva si pasaron N segundos desde la última
        self.cooldown_seconds: float = 10.0          # configurable desde fuera
        self._last_fault_time: float = 0.0
        self._fault_active: bool = False              # estado actual: en falla o no

        # ── Filtro de frecuencia ──────────────────────────────────────────────
        # None = sin filtro; (f_low, f_high) = bandpass en Hz
        self.freq_min_hz: float | None = None
        self.freq_max_hz: float | None = None

        # ── Umbral manual ─────────────────────────────────────────────────────
        # Si se fija un valor > 0, anula completamente el cálculo automático
        # (media_baseline + factor×σ) y usa este valor directo.
        self.manual_threshold: float | None = None

    # ── API pública: actualizar configuración ──────────────────────────────
    def set_config(
        self,
        cooldown: float | None = None,
        freq_min: float | None = None,
        freq_max: float | None = None,
        threshold_factor: float | None = None,
        manual_threshold: float | None = None,   # -1 = borrar umbral manual
    ):
        if cooldown is not None:
            self.cooldown_seconds = max(0.0, cooldown)
        if freq_min is not None:
            self.freq_min_hz = max(0.5, freq_min)
        if freq_max is not None:
            self.freq_max_hz = min(freq_max, SAMPLE_RATE / 2 - 1)
        if threshold_factor is not None:
            self._threshold_factor = max(0.5, threshold_factor)
        else:
            if not hasattr(self, '_threshold_factor'):
                self._threshold_factor = THRESHOLD_FACTOR
        if manual_threshold is not None:
            # -1 es el valor centinela para "quitar el umbral manual"
            self.manual_threshold = None if manual_threshold < 0 else max(0.0, manual_threshold)

    def reset_baseline(self):
        """Reinicia la calibración (útil tras cambiar configuración)."""
        self.baseline_energy = []
        self.baseline_ready = False
        self.energy_history.clear()
        self.total_fallas = 0
        self._last_fault_time = 0.0
        self._fault_active = False

    # ── Filtro Butterworth paso-banda ──────────────────────────────────────
    def _apply_bandpass(self, signal: np.ndarray) -> np.ndarray:
        f_min = self.freq_min_hz
        f_max = self.freq_max_hz
        nyq = SAMPLE_RATE / 2.0

        if f_min is None and f_max is None:
            return signal   # sin filtro

        try:
            if f_min is not None and f_max is not None:
                low = f_min / nyq
                high = f_max / nyq
                # Clamp para evitar inestabilidad numérica
                low = max(1e-4, min(low, 0.9999))
                high = max(1e-4, min(high, 0.9999))
                if low >= high:
                    return signal
                b, a = butter(4, [low, high], btype='band')
            elif f_min is not None:
                low = max(1e-4, min(f_min / nyq, 0.9999))
                b, a = butter(4, low, btype='high')
            else:
                high = max(1e-4, min(f_max / nyq, 0.9999))
                b, a = butter(4, high, btype='low')

            return filtfilt(b, a, signal)
        except Exception:
            return signal   # si falla el filtro, devuelve señal sin filtrar

    def add_data(self, x: float, y: float, z: float):
        self.buffers['x'].append(x)
        self.buffers['y'].append(y)
        self.buffers['z'].append(z)

    def process(self) -> dict | None:
        if len(self.buffers['x']) < WINDOW_SIZE:
            return None

        factor = getattr(self, '_threshold_factor', THRESHOLD_FACTOR)

        # ── Calcular energía Wavelet (con filtro de frecuencia opcional) ────
        total_energy = 0.0
        for axis in ['x', 'y', 'z']:
            sig = np.array(self.buffers[axis], dtype=float)
            sig -= np.mean(sig)                  # quitar DC
            sig = self._apply_bandpass(sig)      # filtro Hz (puede ser no-op)
            coeffs = pywt.wavedec(sig, 'db4', level=4)
            total_energy += float(np.sum(np.square(coeffs[-1])))

        # ── Fase de calibración ─────────────────────────────────────────────
        if not self.baseline_ready:
            self.baseline_energy.append(total_energy)
            if len(self.baseline_energy) >= 30:
                self.baseline_ready = True
            return {
                "sensor_id": self.id,
                "energy": round(total_energy, 4),
                "energy_history": list(self.energy_history),
                "fault": False,
                "baseline_ready": False,
                "signal_x": list(self.buffers['x']),
                "threshold": 0,
                "total_faults": self.total_fallas,
            }

        # ── Detección de falla ──────────────────────────────────────────────
        # Si hay umbral manual, lo usamos directamente y saltamos la espera
        # de baseline (el sensor puede detectar desde el primer ciclo completo)
        if self.manual_threshold is not None:
            threshold = self.manual_threshold
            threshold_mode = "manual"
            # Marcar baseline como listo para que la UI no muestre "Calibrando"
            if not self.baseline_ready:
                self.baseline_ready = True
        else:
            mean_b = float(np.mean(self.baseline_energy))
            std_b  = float(np.std(self.baseline_energy))
            threshold = mean_b + factor * std_b
            threshold_mode = "auto"

        raw_fault = bool(total_energy > threshold)
        now = time.monotonic()

        # Lógica de cooldown + edge-detection:
        #   - Solo se marca falla nueva si el cooldown expiró
        #   - "fault" en el resultado = disparar una nueva captura
        if raw_fault:
            time_since_last = now - self._last_fault_time
            if time_since_last >= self.cooldown_seconds:
                # Nueva falla (o primera tras cooldown)
                register_new_fault = True
                self._last_fault_time = now
            else:
                # Seguimos en falla pero dentro del cooldown → no capturar
                register_new_fault = False
            self._fault_active = True
        else:
            self._fault_active = False
            register_new_fault = False

        if register_new_fault:
            self.total_fallas += 1

        self.energy_history.append(total_energy)

        return {
            "sensor_id": self.id,
            "energy": round(total_energy, 4),
            "energy_history": list(self.energy_history),
            "fault": register_new_fault,
            "fault_active": raw_fault,
            "baseline_ready": True,
            "threshold": round(threshold, 4),
            "threshold_mode": threshold_mode,      # "manual" | "auto"
            "signal_x": list(self.buffers['x']),
            "total_faults": self.total_fallas,
            "cooldown_remaining": max(
                0.0,
                round(self.cooldown_seconds - (now - self._last_fault_time), 1)
            ) if raw_fault else 0.0,
        }