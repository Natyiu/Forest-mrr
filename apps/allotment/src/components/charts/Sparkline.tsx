import React from 'react';

/**
 * Twelve months of revenue, at the size of a word.
 *
 * It sits beside the headline number and does the one job the headline cannot:
 * say whether $49,592 is the top of a climb or the bottom of a slide. No axes,
 * no labels, no hover — the trend chart in the revenue panel is where you go to
 * read values. This only has to have a shape.
 */

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  /** Accessible summary; the graphic itself is decorative without it. */
  label: string;
}

export const Sparkline: React.FC<SparklineProps> = ({ values, width = 96, height = 28, label }) => {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would otherwise divide by zero and vanish; float it instead.
  const span = max - min || Math.max(1, max * 0.02);

  const inset = 3; // Room for the end marker's ring.
  const stepX = (width - inset * 2) / (values.length - 1);
  const points = values.map((value, index) => ({
    x: inset + index * stepX,
    y: inset + (1 - (value - min) / span) * (height - inset * 2),
  }));

  const line = points.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${height} L${points[0].x.toFixed(1)},${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path d={area} fill="var(--accent)" opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Surface ring keeps the marker legible where it crosses the line. */}
      <circle cx={last.x} cy={last.y} r={4} fill="var(--accent)" stroke="var(--surface-solid)" strokeWidth={2} />
    </svg>
  );
};
