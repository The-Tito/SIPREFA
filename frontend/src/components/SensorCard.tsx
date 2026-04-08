"use client";
import { AlertTriangle, CheckCircle, Loader } from "lucide-react";
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

  const isFault = data.fault;
  const isCalibrating = !data.baseline_ready;

  return (
    <div
      className={`border rounded-2xl p-5 shadow-sm transition-all ${
        isFault ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
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
          {isFault ? (
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
          fault={isFault}
        />
      </div>
    </div>
  );
}
