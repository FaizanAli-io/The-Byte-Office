import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finance Tools",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="finance-workspace min-h-screen bg-[#070b12] text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,.09),transparent_28rem),radial-gradient(circle_at_90%_25%,rgba(99,102,241,.08),transparent_32rem)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
