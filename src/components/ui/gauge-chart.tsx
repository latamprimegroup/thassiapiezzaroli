"use client";

type GaugeChartProps = {
  value: number;
  min: number;
  max: number;
  label: string;
};

export function GaugeChart({ value, min, max, label }: GaugeChartProps) {
  const safeRange = Math.max(1, max - min);
  const ratio = Math.max(0, Math.min(1, (value - min) / safeRange));
  const angle = -90 + ratio * 180;
  const toneClass = value < min + safeRange * 0.4 ? "text-[#EA4335]" : value < min + safeRange * 0.7 ? "text-[#FF9900]" : "text-[#10B981]";
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <p className="mb-1 text-xs text-slate-300">{label}</p>
      <div className="relative mx-auto h-24 w-44">
        <div className="absolute left-1/2 top-full h-20 w-40 -translate-x-1/2 -translate-y-full rounded-t-full border-8 border-white/10 border-b-0" />
        <div
          className="absolute left-1/2 top-[88%] h-1 w-16 origin-left bg-[#FF9900]"
          style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
        />
        <div className="absolute left-1/2 top-[88%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF9900]" />
        <p className={`absolute left-1/2 top-[68%] -translate-x-1/2 text-lg font-semibold ${toneClass}`}>{value.toFixed(2)}x</p>
      </div>
    </div>
  );
}
