export default function BackgroundEffect() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="grid-lines absolute inset-x-0 top-0 h-[42rem]" />
      <div className="absolute left-[8%] top-24 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="absolute right-[6%] top-96 h-80 w-80 rounded-full bg-teal-600/10 blur-3xl" />
    </div>
  );
}
