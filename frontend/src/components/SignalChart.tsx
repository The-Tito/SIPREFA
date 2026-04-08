"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export default function SignalChart({ data }: { data: number[] }) {
  const chartData = data.map((v, i) => ({ i, v: parseFloat(v.toFixed(3)) }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData}>
        <XAxis dataKey="i" hide />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(v) => [typeof v === "number" ? v.toFixed(3) : v, "Amplitud"]}
          labelFormatter={(l) => `Muestra ${l}`}
          contentStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke="#2563eb"
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
