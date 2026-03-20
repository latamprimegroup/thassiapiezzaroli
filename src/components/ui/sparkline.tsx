"use client";

type SparklineProps = {
  values: number[];
  className?: string;
  strokeClassName?: string;
};

export function Sparkline({ values, className = "h-8 w-28", strokeClassName = "stroke-[#FF9900]" }: SparklineProps) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  const normalized = safeValues.length >= 2 ? safeValues : safeValues.length === 1 ? [safeValues[0], safeValues[0]] : [0, 0];
  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;

  const points = normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 28" className={className}>
      <polyline fill="none" strokeWidth="2.2" className={strokeClassName} points={points} />
    </svg>
  );
}
