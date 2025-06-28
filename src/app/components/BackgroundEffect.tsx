export default function BackgroundEffect({
  mousePosition
}: {
  mousePosition: { x: number; y: number };
}) {
  return (
    <div className="fixed inset-0 z-0">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>

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
    </div>
  );
}
