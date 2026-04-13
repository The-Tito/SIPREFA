/**
 * Centralized API and WebSocket URLs.
 * To override for a different environment, set the following in `.env.local`:
 *   NEXT_PUBLIC_API_URL=http://your-host:8000
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");

export const API_URLS = {
  ports: `${API_BASE}/ports`,
  faults: `${API_BASE}/faults`,
  config: `${API_BASE}/config`,
  ws: `${WS_BASE}/ws`,
} as const;