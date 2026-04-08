"use client";
import { useEffect, useState } from "react";
import { Usb, Wifi, WifiOff } from "lucide-react";
import { API_URLS } from "@/lib/config";

type Port = { device: string; description: string };

type Props = {
  connected: boolean;
  onConnect: (port: string) => void;
  onDisconnect: () => void;
};

export default function ConnectionPanel({
  connected,
  onConnect,
  onDisconnect,
}: Props) {
  const [ports, setPorts] = useState<Port[]>([]);
  const [selected, setSelected] = useState("");
  const [autoDetected, setAutoDetected] = useState("");

  useEffect(() => {
    fetch(API_URLS.ports)
      .then((r) => r.json())
      .then((data) => {
        setPorts(data.ports);
        if (data.auto_detected) {
          setAutoDetected(data.auto_detected);
          setSelected(data.auto_detected);
        }
      });
  }, []);

  return (
    <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
      <Usb className="text-gray-400" size={20} />

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={connected}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 disabled:opacity-50"
      >
        <option value="">Seleccionar puerto...</option>
        {ports.map((p) => (
          <option key={p.device} value={p.device}>
            {p.device} — {p.description}
            {p.device === autoDetected ? " ⚡ Auto" : ""}
          </option>
        ))}
      </select>

      {!connected ? (
        <button
          onClick={() => selected && onConnect(selected)}
          disabled={!selected}
          className="flex items-center gap-2 bg-teal-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-teal-700 disabled:opacity-40 transition-colors"
        >
          <Wifi size={16} /> Conectar
        </button>
      ) : (
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 bg-red-500 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-red-600 transition-colors"
        >
          <WifiOff size={16} /> Desconectar
        </button>
      )}

      <span
        className={`text-xs font-medium px-2 py-1 rounded-full ${
          connected
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {connected ? "● En línea" : "○ Sin conexión"}
      </span>
    </div>
  );
}
