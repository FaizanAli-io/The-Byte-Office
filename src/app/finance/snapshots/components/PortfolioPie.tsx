"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const COLORS = ["#34d399", "#60a5fa", "#a78bfa"];

export function PortfolioPie({ snapshot }: any) {
  const local: number = snapshot.data.localBanks.reduce(
    (sum: number, b: any) => sum + b.amountPkr,
    0
  );
  const remote: number = snapshot.data.remoteBanks.reduce(
    (sum: number, b: any) => sum + b.amountUsd * b.exchangeRate,
    0
  );
  const mutual: number = snapshot.data.mutualFunds.reduce(
    (total: number, mf: any) => {
      const bankKey = Object.keys(mf)[0];
      const funds = mf[bankKey];
      return total + funds.reduce((s: number, f: any) => s + f.value, 0);
    },
    0
  );

  const data = [
    { name: "Local Banks", value: local },
    { name: "Remote Banks", value: remote },
    { name: "Mutual Funds", value: mutual }
  ];

  return (
    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-600/30">
      <h4 className="text-lg font-semibold text-slate-300 mb-2">
        Overall Portfolio Distribution
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
