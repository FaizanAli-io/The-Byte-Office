"use client";

import { useEffect, useState } from "react";

export default function BackgroundEffect() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>

      {/* Ambient Orbs */}
      <div
        className="absolute w-96 h-96 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-full blur-3xl opacity-70 animate-pulse"
        style={{
          transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
          left: "10%",
          top: "20%"
        }}
      />
      <div
        className="absolute w-80 h-80 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl opacity-60 animate-pulse"
        style={{
          transform: `translate(${mousePosition.x * -0.01}px, ${mousePosition.y * -0.01}px)`,
          right: "10%",
          bottom: "20%",
          animationDelay: "1s"
        }}
      />

      {/* Floating Elements */}
      <div className="absolute top-1/4 left-[10%] w-20 h-20 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full animate-pulse blur-sm"></div>
      <div
        className="absolute top-1/3 right-[15%] w-16 h-16 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full animate-pulse blur-sm"
        style={{ animationDelay: "1s" }}
      ></div>
      <div
        className="absolute bottom-1/4 left-[20%] w-12 h-12 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-full animate-pulse blur-sm"
        style={{ animationDelay: "2s" }}
      ></div>
    </div>
  );
}
