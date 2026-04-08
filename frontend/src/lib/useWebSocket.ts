import { useEffect, useRef, useState, useCallback } from "react";
import { API_URLS } from "./config";

export type SensorData = {
  sensor_id: number;
  energy: number;
  energy_history: number[];
  fault: boolean;
  baseline_ready: boolean;
  threshold: number;
  signal_x: number[];
  total_faults: number;
  fault_snapshot?: { id: number; timestamp: string };
  timestamp: string;
};

export type WSMessage =
  | { sensors: SensorData[] }
  | { status: string; port: string }
  | { error: string };

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sensorData, setSensorData] = useState<Record<number, SensorData>>({});

  const connect = useCallback((port: string) => {
    ws.current = new WebSocket(API_URLS.ws);

    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({ port }));
    };

    ws.current.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);

      if ("error" in msg) {
        setError(msg.error);
        setConnected(false);
        return;
      }

      if ("status" in msg) {
        setConnected(true);
        setError(null);
        return;
      }

      if ("sensors" in msg) {
        setSensorData((prev) => {
          const updated = { ...prev };
          msg.sensors.forEach((s) => (updated[s.sensor_id] = s));
          return updated;
        });
      }
    };

    ws.current.onerror = () => setError("Error de conexión con el backend");
    ws.current.onclose = () => setConnected(false);
  }, []);

  const disconnect = useCallback(() => {
    ws.current?.close();
    setConnected(false);
    setSensorData({});
  }, []);

  useEffect(() => () => ws.current?.close(), []);

  return { connected, error, sensorData, connect, disconnect };
}
