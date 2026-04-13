"use client";
import { AlertTriangle, CheckCircle, Loader, Clock } from "lucide-react";
import { SensorData } from "@/lib/useWebSocket";
import SignalChart from "./SignalChart";
import EnergyChart from "./EnergyChart";

export default function SensorCard({
  data,
  id,
}: {
  data: SensorData | undefined;
  id: number;
}) {
  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader size={16} className="animate-spin" />
          <span className="text-sm">Esperando datos del sensor {id}...</span>
        </div>
      </div>
    );
  }

  // fault_active = actualmente sobre umbral (visual rojo)
  // fault       = nueva captura disparada en este ciclo
  const isFaultActive = data.fault_active ?? data.fault;
  const isCalibrating = !data.baseline_ready;
  const cooldownRemaining = data.cooldown_remaining ?? 0;

  return (
    <div
      className={`border rounded-2xl p-5 shadow-sm transition-all ${
        isFaultActive ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">
            Sensor {data.sensor_id}
          </span>
          {isCalibrating && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              Calibrando...
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{data.timestamp}</span>
          {isFaultActive ? (
            <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
              <AlertTriangle size={16} /> FALLA
            </span>
          ) : (
            <span className="flex items-center gap-1 text-green-600 text-sm">
              <CheckCircle size={16} /> Normal
            </span>
          )}
        </div>
      </div>

      {/* Cooldown indicator — solo aparece cuando el sensor está en falla pero en cooldown */}
      {isFaultActive && cooldownRemaining > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
          <Clock size={13} />
          <span>
            Próxima captura en <strong>{cooldownRemaining}s</strong> (cooldown activo)
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Energía</p>
          <p className="text-sm font-semibold tabular-nums">
            {data.energy.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Umbral</p>
          <p className="text-sm font-semibold tabular-nums">
            {data.threshold ? data.threshold.toFixed(2) : "—"}
          </p>
          {data.threshold_mode === "manual" && (
            <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-medium">
              manual
            </span>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400 mb-0.5">Fallas totales</p>
          <p
            className={`text-sm font-semibold tabular-nums ${data.total_faults > 0 ? "text-red-600" : ""}`}
          >
            {data.total_faults}
          </p>
        </div>
      </div>

      {/* Gráficas */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
          Señal — Eje X (Amplitud)
        </p>
        <SignalChart data={data.signal_x} />

        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-3">
          Energía Wavelet (X+Y+Z)
        </p>
        <EnergyChart
          data={data.energy_history ?? []}
          threshold={data.threshold ?? 0}
          fault={isFaultActive}
        />
      </div>
    </div>
  );
}