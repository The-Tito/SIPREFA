"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";

type Props = { data: number[]; threshold: number; fault: boolean };

export default function EnergyChart({ data, threshold, fault }: Props) {
  const chartData = data.map((v, i) => ({ i, v: parseFloat(v.toFixed(2)) }));

  return (
    <div
      className={`rounded-lg transition-colors ${fault ? "bg-red-50" : "bg-white"}`}
    >
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData}>
          <XAxis dataKey="i" hide />
          <YAxis domain={[0, "auto"]} tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, "Energía"]}
            contentStyle={{ fontSize: 12 }}
          />
          {threshold > 0 && (
            <ReferenceLine
              y={threshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: "Umbral", fontSize: 10, fill: "#ef4444" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="v"
            stroke={fault ? "#ef4444" : "#2563eb"}
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
