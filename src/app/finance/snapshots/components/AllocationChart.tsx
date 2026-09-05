"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const colors = [
  "#67e8f9",
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#c084fc",
  "#2dd4bf",
];

export function AllocationChart({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const visible = data.filter((item) => item.value > 0);

  return (
    <div className="rounded-xl border border-white/7 bg-slate-950/45 p-4">
      <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      {visible.length ? (
        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visible}
                dataKey="value"
                nameKey="name"
                innerRadius="34%"
                outerRadius="55%"
                paddingAngle={3}
                stroke="transparent"
              >
                {visible.map((item, index) => (
                  <Cell key={item.name} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toLocaleString()} PKR`}
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
                }}
                itemStyle={{ color: "#0f172a", fontWeight: 700 }}
                labelStyle={{ color: "#475569", fontWeight: 700 }}
              />
              <Legend
                wrapperStyle={{ color: "#94a3b8", fontSize: 12 }}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center text-sm text-slate-600 sm:h-80">
          No values in this snapshot
        </div>
      )}
    </div>
  );
}
