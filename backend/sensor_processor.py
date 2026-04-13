import numpy as np
import pywt
from collections import deque

WINDOW_SIZE = 512
THRESHOLD_FACTOR = 3


class SensorProcessor:
    def __init__(self, sensor_id: int):
        self.id = sensor_id
        self.buffers = {
            'x': deque(maxlen=WINDOW_SIZE),
            'y': deque(maxlen=WINDOW_SIZE),
            'z': deque(maxlen=WINDOW_SIZE)
        }
        self.energy_history = deque(maxlen=100)
        self.baseline_energy = []
        self.baseline_ready = False
        self.total_fallas = 0

    def add_data(self, x: float, y: float, z: float):
        self.buffers['x'].append(x)
        self.buffers['y'].append(y)
        self.buffers['z'].append(z)

    def process(self):
        if len(self.buffers['x']) < WINDOW_SIZE:
            return None

        total_energy = 0
        for axis in ['x', 'y', 'z']:
            sig = np.array(self.buffers[axis])
            sig = sig - np.mean(sig)
            coeffs = pywt.wavedec(sig, 'db4', level=4)
            total_energy += np.sum(np.square(coeffs[-1]))

        if not self.baseline_ready:
            self.baseline_energy.append(total_energy)
            if len(self.baseline_energy) >= 30:
                self.baseline_ready = True
            return {
                "sensor_id": self.id,
                "energy": round(total_energy, 4),
                "fault": False,
                "baseline_ready": False,
                "signal_x": list(self.buffers['x'])
            }

        threshold = (
            np.mean(self.baseline_energy)
            + THRESHOLD_FACTOR * np.std(self.baseline_energy)
        )
        fault = bool(total_energy > threshold)

        if fault:
            self.total_fallas += 1

        self.energy_history.append(total_energy)

        return {
            "sensor_id": self.id,
            "energy": round(total_energy, 4),
            "energy_history": list(self.energy_history),
            "fault": fault,
            "baseline_ready": True,
            "threshold": round(threshold, 4),
            "signal_x": list(self.buffers['x']),
            "total_faults": self.total_fallas
        }