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
  return children;
}
