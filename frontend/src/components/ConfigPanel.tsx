"use client";
import { useEffect, useState } from "react";
import { Settings, ChevronDown, ChevronUp, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { API_URLS } from "@/lib/config";

type SensorConfig = {
  sensor_id: number;
  cooldown: number;
  freq_min: number | null;
  freq_max: number | null;
  threshold_factor: number;
  manual_threshold: number | null;
};

export default function ConfigPanel() {
  const [open, setOpen] = useState(false);
  const [, setConfigs] = useState<SensorConfig[]>([]);
  const [applyToAll, setApplyToAll] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    cooldown: "10",
    freq_min: "",
    freq_max: "",
    threshold_factor: "3",
    manual_threshold_enabled: false,
    manual_threshold: "",
    reset_baseline: false,
  });

  useEffect(() => {
    fetch(API_URLS.config)
      .then((r) => r.json())
      .then((data) => {
        if (data.sensors?.length > 0) {
          setConfigs(data.sensors);
          const first = data.sensors[0];
          setForm({
            cooldown: String(first.cooldown),
            freq_min: first.freq_min != null ? String(first.freq_min) : "",
            freq_max: first.freq_max != null ? String(first.freq_max) : "",
            threshold_factor: String(first.threshold_factor),
            manual_threshold_enabled: first.manual_threshold != null,
            manual_threshold: first.manual_threshold != null ? String(first.manual_threshold) : "",
            reset_baseline: false,
          });
        }
      })
      .catch(() => { });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);

    // Si el umbral manual está desactivado enviamos -1 como centinela para borrarlo
    const manual_threshold = form.manual_threshold_enabled
      ? parseFloat(form.manual_threshold) || null
      : -1;

    const payload = {
      sensor_id: applyToAll ? 0 : 1,
      cooldown: parseFloat(form.cooldown) || 10,
      freq_min: form.freq_min !== "" ? parseFloat(form.freq_min) : null,
      freq_max: form.freq_max !== "" ? parseFloat(form.freq_max) : null,
      threshold_factor: parseFloat(form.threshold_factor) || 3,
      manual_threshold,
      reset_baseline: form.reset_baseline,
    };

    try {
      await fetch(API_URLS.config, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings size={17} className="text-teal-600" />
          <span className="font-semibold text-gray-800 text-sm">
            Configuración de Detección
          </span>
          <span className="text-xs text-gray-400 ml-1">
            Umbral · Cooldown · Filtro de frecuencia
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Apply-to selector */}
          <div className="flex items-center gap-3 mt-4 mb-5">
            <span className="text-xs text-gray-500 font-medium">Aplicar a:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button
                onClick={() => setApplyToAll(true)}
                className={`px-3 py-1.5 transition-colors ${applyToAll ? "bg-teal-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
              >
                Todos los sensores
              </button>
              <button
                onClick={() => setApplyToAll(false)}
                className={`px-3 py-1.5 transition-colors ${!applyToAll ? "bg-teal-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
                  }`}
              >
                Solo sensor 1
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Cooldown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Cooldown entre capturas (seg)
              </label>
              <input
                type="number" min="0" step="1"
                value={form.cooldown}
                onChange={(e) => setForm((f) => ({ ...f, cooldown: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <p className="text-xs text-gray-400">
                Tiempo mínimo entre dos capturas del mismo sensor. Recomendado: 10–30 seg.
              </p>
            </div>

            {/* Threshold factor — deshabilitado si hay umbral manual */}
            <div className={`space-y-1.5 transition-opacity ${form.manual_threshold_enabled ? "opacity-40 pointer-events-none" : ""}`}>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Factor de umbral automático (σ)
              </label>
              <input
                type="number" min="0.5" max="10" step="0.5"
                value={form.threshold_factor}
                disabled={form.manual_threshold_enabled}
                onChange={(e) => setForm((f) => ({ ...f, threshold_factor: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-400">
                Umbral = media + σ × desviación. Más alto = menos sensible. Default: 3.
              </p>
            </div>

            {/* Freq min */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Frecuencia mínima (Hz)
              </label>
              <input
                type="number" min="0.5" max="49" step="0.5"
                placeholder="Sin límite"
                value={form.freq_min}
                onChange={(e) => setForm((f) => ({ ...f, freq_min: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-gray-300"
              />
              <p className="text-xs text-gray-400">
                Ignorar vibraciones por debajo de este valor.
              </p>
            </div>

            {/* Freq max */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Frecuencia máxima (Hz)
              </label>
              <input
                type="number" min="1" max="50" step="0.5"
                placeholder="Sin límite (máx 50 Hz)"
                value={form.freq_max}
                onChange={(e) => setForm((f) => ({ ...f, freq_max: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-gray-300"
              />
              <p className="text-xs text-gray-400">
                Ignorar vibraciones por encima de este valor. Nyquist = 50 Hz.
              </p>
            </div>
          </div>

          {/* ── Umbral manual ────────────────────────────────────────────── */}
          <div className="mt-5 border border-gray-200 rounded-xl overflow-hidden">
            {/* Toggle header */}
            <button
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  manual_threshold_enabled: !f.manual_threshold_enabled,
                }))
              }
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  Umbral manual fijo
                </span>
                <p className="text-xs text-gray-400 text-left mt-0.5">
                  {form.manual_threshold_enabled
                    ? "Activo — anula el cálculo automático por baseline"
                    : "Inactivo — se usa el umbral calculado automáticamente"}
                </p>
              </div>
              {form.manual_threshold_enabled ? (
                <ToggleRight size={28} className="text-teal-600 flex-shrink-0" />
              ) : (
                <ToggleLeft size={28} className="text-gray-300 flex-shrink-0" />
              )}
            </button>

            {/* Input del valor — aparece solo si está activado */}
            {form.manual_threshold_enabled && (
              <div className="px-4 py-4 space-y-2 bg-teal-50 border-t border-teal-100">
                <label className="text-xs font-semibold text-teal-800 uppercase tracking-wide">
                  Valor de umbral (energía Wavelet absoluta)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Ej: 125000.00"
                  value={form.manual_threshold}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, manual_threshold: e.target.value }))
                  }
                  className="w-full border border-teal-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <p className="text-xs text-teal-700">
                  💡 Observa la gráfica <em>Energía Wavelet</em> durante operación normal
                  para obtener un valor de referencia. El umbral recomendado es ~120–150 % de esa energía.
                  Con umbral manual el baseline sigue corriendo pero no se usa para la detección.
                </p>
              </div>
            )}
          </div>

          {/* Presets rápidos de frecuencia */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Presets rápidos de frecuencia
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Router CNC típica (5–40 Hz)", min: "5", max: "40" },
                { label: "Vibración mecánica baja (1–20 Hz)", min: "1", max: "20" },
                { label: "Alta frecuencia (20–50 Hz)", min: "20", max: "" },
                { label: "Sin filtro de frecuencia", min: "", max: "" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() =>
                    setForm((f) => ({ ...f, freq_min: preset.min, freq_max: preset.max }))
                  }
                  className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reset baseline */}
          <label className="flex items-center gap-2.5 mt-5 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.reset_baseline}
              onChange={(e) => setForm((f) => ({ ...f, reset_baseline: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-400 cursor-pointer"
            />
            <span className="text-xs text-gray-600 group-hover:text-gray-800 transition-colors">
              <span className="font-semibold">Reiniciar baseline</span> — recalibra
              desde cero al aplicar (recomendado al cambiar el filtro o el umbral)
            </span>
          </label>

          {/* Save button */}
          <div className="flex justify-end mt-5">
            <button
              onClick={handleSave}
              disabled={saving || (form.manual_threshold_enabled && form.manual_threshold === "")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${saved
                  ? "bg-green-500 text-white"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
                } disabled:opacity-60`}
            >
              {saved ? <>✓ Guardado</> : (
                <>
                  <Save size={15} />
                  {saving ? "Aplicando..." : "Aplicar configuración"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}