"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const COLORS = [
  "#f87171",
  "#fb923c",
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#a78bfa",
  "#ec4899"
];

export function IndividualFundsPie({ snapshot }: any) {
  const allFunds: { name: string; value: number }[] = [];

  snapshot.data.mutualFunds.forEach((mf: any) => {
    const bankKey = Object.keys(mf)[0];
    mf[bankKey].forEach((f: any) => {
      allFunds.push({
        name: `${bankKey}: ${f.fund}`,
        value: f.value
      });
    });
  });

  return (
    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30">
      <h4 className="text-lg font-semibold text-slate-300 mb-2">
        Individual Mutual Funds
      </h4>
      <ResponsiveContainer width="100%" height={480}>
        <PieChart>
          <Pie
            data={allFunds}
            dataKey="value"
            nameKey="name"
            outerRadius={110}
            labelLine={true}
            label={({ percent }) => (Number(percent) * 100).toFixed(1) + "%"}
          >
            {allFunds.map((_, i) => (
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
