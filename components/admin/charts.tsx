"use client";

import { formatNumber } from "./api";

export type ChartPoint = { label: string; value: number; secondary?: number };

export function BarChart({
  data,
  formatValue = (value: number) => formatNumber(value),
  height = 220,
}: {
  data: ChartPoint[];
  formatValue?: (value: number) => string;
  height?: number;
}) {
  if (!data.length) {
    return <p className="rv-hint">No data for this period yet.</p>;
  }

  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="rv-bars" style={{ height }}>
      {data.map((point) => (
        <div className="rv-bars__item" key={point.label} title={`${point.label}: ${formatValue(point.value)}`}>
          <span className="rv-hint" style={{ fontSize: "0.68rem" }}>
            {point.value > 0 ? formatValue(point.value) : ""}
          </span>
          <div className="rv-bars__fill" style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }} />
          <span className="rv-bars__label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({ data, height = 200 }: { data: ChartPoint[]; height?: number }) {
  if (data.length < 2) {
    return <p className="rv-hint">Not enough data to draw a trend yet.</p>;
  }

  const width = 640;
  const padding = 24;
  const max = Math.max(...data.map((point) => point.value), 1);
  const step = (width - padding * 2) / (data.length - 1);
  const points = data.map((point, index) => {
    const x = padding + index * step;
    const y = height - padding - (point.value / max) * (height - padding * 2);
    return { x, y, ...point };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${path} L${points[points.length - 1].x.toFixed(1)},${height - padding} L${points[0].x.toFixed(1)},${height - padding} Z`;

  return (
    <svg className="rv-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Trend chart">
      <path d={area} fill="rgba(71, 125, 104, 0.14)" />
      <path d={path} fill="none" stroke="#477d68" strokeWidth="2" />
      {points.map((point) => (
        <circle key={point.label} cx={point.x} cy={point.y} r="2.5" fill="#103b2c">
          <title>{`${point.label}: ${formatNumber(point.value)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
