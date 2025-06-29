"use client";

import Link from "next/link";

interface Props {
  href: string;
  label: string;
}

export function PrimaryCTAButton({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-white font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25"
    >
      <span className="relative z-10">{label}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
      <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full"></div>
    </Link>
  );
}

export function SecondaryCTAButton({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="group relative px-8 py-4 border-2 border-white/20 rounded-full text-white font-semibold text-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/40 hover:scale-105"
    >
      <span className="relative z-10">{label}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
    </Link>
  );
}
