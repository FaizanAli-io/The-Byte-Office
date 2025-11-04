"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f87171"];

export function MutualFundsPie({ snapshot }: any) {
  const data: { name: string; value: number }[] = snapshot.data.mutualFunds.map(
    (mf: any) => {
      const bankKey = Object.keys(mf)[0];
      const total = mf[bankKey].reduce(
        (sum: number, f: any) => sum + f.value,
        0
      );
      return { name: bankKey, value: total };
    }
  );

  return (
    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30">
      <h4 className="text-lg font-semibold text-slate-300 mb-2">
        Mutual Funds (by Bank)
      </h4>
      <ResponsiveContainer width="100%" height={480}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            labelLine={true}
            label={({ percent }) => (Number(percent) * 100).toFixed(1) + "%"}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => `${v.toLocaleString()} PKR`}
            contentStyle={{ backgroundColor: "#1f2937", border: "none" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
