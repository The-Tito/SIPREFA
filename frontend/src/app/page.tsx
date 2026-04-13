"use client";
import { useWebSocket } from "@/lib/useWebSocket";
import ConnectionPanel from "@/components/ConnectionPanel";
import SensorCard from "@/components/SensorCard";
import { AlertTriangle, Power } from "lucide-react";
import FaultHistory from "@/components/FaultHistory";
import ConfigPanel from "@/components/ConfigPanel";

export default function Dashboard() {
  const { connected, error, sensorData, connect, disconnect } = useWebSocket();

  // fault_active = sensor actualmente sobre el umbral (no necesariamente captura nueva)
  const activeFaults = Object.values(sensorData).filter((s) => s.fault_active).length;

  const handleShutdown = async () => {
    if (confirm("¿Estás seguro de que deseas apagar la aplicación?")) {
      try {
        await fetch("http://localhost:8000/shutdown", { method: "POST" });
        window.close();
      } catch (e) {
        console.log("Aplicación cerrada", e);
      }
    }
  };

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

          <div className="flex items-center gap-3">
            <ConnectionPanel
              connected={connected}
              onConnect={connect}
              onDisconnect={disconnect}
            />
            <button
              onClick={handleShutdown}
              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 border border-red-200 rounded-lg text-sm font-semibold transition-colors shadow-sm"
              title="Apagar y cerrar servidor"
            >
              <Power size={18} />
              Apagar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alerta global de falla activa */}
        {activeFaults > 0 && (
          <div className="flex items-center gap-3 bg-red-600 text-white px-5 py-3 rounded-xl shadow-md animate-pulse">
            <AlertTriangle size={20} />
            <span className="font-semibold">
              ⚠️ {activeFaults} sensor{activeFaults > 1 ? "es" : ""} fuera de
              rango detectado{activeFaults > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Error de conexión */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Panel de configuración */}
        <ConfigPanel />

        {/* Grid de sensores */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {Object.keys(sensorData).length > 0
            ? Object.values(sensorData).map((data) => (
                <SensorCard key={data.sensor_id} id={data.sensor_id} data={data} />
              ))
            : [1, 2, 3].map((id) => (
                <SensorCard key={id} id={id} data={undefined} />
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