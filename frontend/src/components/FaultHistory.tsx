"use client";
import { useEffect, useState } from "react";
import { Trash2, Download, AlertTriangle } from "lucide-react";
import { API_URLS } from "@/lib/config";

type FaultEntry = {
  id: number;
  sensor_id: number;
  timestamp: string;
  energy: number;
  threshold: number;
  image_b64: string;
};

export default function FaultHistory() {
  const [faults, setFaults] = useState<FaultEntry[]>([]);
  const [selected, setSelected] = useState<FaultEntry | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchFaults = () => {
    fetch(API_URLS.faults)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setFaults([...data.faults].reverse()); // spread evita mutar el array original
        setError(null);
      })
      .catch(() => setError("No se pudo conectar con el backend"));
  };

  useEffect(() => {
    fetchFaults();
    const interval = setInterval(fetchFaults, 3000); // refresca cada 3s
    return () => clearInterval(interval);
  }, []);

  const clearFaults = async () => {
    await fetch(API_URLS.faults, { method: "DELETE" });
    setFaults([]);
    setSelected(null);
  };

  const downloadImage = (fault: FaultEntry) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${fault.image_b64}`;
    link.download = `falla_S${fault.sensor_id}_${fault.timestamp.replace(/:/g, "-")}.png`;
    link.click();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="font-semibold text-gray-800">Historial de Fallas</h2>
          {faults.length > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
              {faults.length}
            </span>
          )}
        </div>
        {faults.length > 0 && (
          <button
            onClick={clearFaults}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} /> Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="px-5 py-2 text-xs text-red-500 bg-red-50 border-b border-red-100">
          ⚠ {error}
        </div>
      )}

      <div className="flex h-[420px]">
        {/* Lista de fallas */}
        <div className="w-72 border-r border-gray-100 overflow-y-auto">
          {faults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
              <AlertTriangle size={32} />
              <p className="text-sm">Sin fallas registradas</p>
            </div>
          ) : (
            faults.map((fault) => (
              <button
                key={fault.id}
                onClick={() => setSelected(fault)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selected?.id === fault.id
                    ? "bg-red-50 border-l-2 border-l-red-400"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-600">
                    Sensor {fault.sensor_id}
                  </span>
                  <span className="text-xs text-gray-400">#{fault.id}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fault.timestamp}
                </p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-gray-400">
                    E:{" "}
                    <span className="font-medium tabular-nums text-gray-600">
                      {fault.energy.toFixed(2)}
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">
                    U:{" "}
                    <span className="font-medium tabular-nums text-gray-600">
                      {fault.threshold.toFixed(2)}
                    </span>
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Vista de captura */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-gray-50">
          {selected ? (
            <>
              <img
                src={`data:image/png;base64,${selected.image_b64}`}
                alt={`Falla sensor ${selected.sensor_id}`}
                className="rounded-lg shadow-md max-h-[320px] object-contain"
              />
              <button
                onClick={() => downloadImage(selected)}
                className="mt-3 flex items-center gap-2 text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Download size={13} /> Descargar captura
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-300">
              Selecciona una falla para ver la captura
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
