"use client";
import { useWebSocket } from "@/lib/useWebSocket";
import ConnectionPanel from "@/components/ConnectionPanel";
import SensorCard from "@/components/SensorCard";
import { AlertTriangle } from "lucide-react";
import FaultHistory from "@/components/FaultHistory";

export default function Dashboard() {
  const { connected, error, sensorData, connect, disconnect } = useWebSocket();

  const totalFaults = Object.values(sensorData).filter((s) => s.fault).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              CNC Fault Detector
            </h1>
            <p className="text-xs text-gray-400">
              Análisis Wavelet en Tiempo Real
            </p>
          </div>

          <ConnectionPanel
            connected={connected}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alerta global de falla */}
        {totalFaults > 0 && (
          <div className="flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-xl shadow-md animate-pulse">
            <AlertTriangle size={20} />
            <span className="font-semibold">
              ⚠️ {totalFaults} sensor{totalFaults > 1 ? "es" : ""} fuera de
              rango detectado
              {totalFaults > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Error de conexión */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Grid de sensores */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((id) => (
            <SensorCard key={id} id={id} data={sensorData[id]} />
          ))}
        </div>
        <FaultHistory />

        {/* Estado inicial */}
        {!connected && !error && (
          <div className="text-center text-gray-400 py-20">
            <p className="text-lg">
              Conecta el ESP32 y presiona <strong>Conectar</strong>
            </p>
            <p className="text-sm mt-1">
              El sistema detectará el puerto automáticamente
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
