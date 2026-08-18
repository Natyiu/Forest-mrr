import React from 'react';

/**
 * The pieces every chart in the app shares.
 *
 * Three rules are enforced here rather than remembered in four places:
 *
 *  - **Marks carry colour, text never does.** Values and labels wear ink
 *    tokens; identity comes from the swatch beside them. A light accent as
 *    label text is illegible on the surface it sits on.
 *  - **Every chart has a hover layer.** An SVG chart that cannot be
 *    interrogated is a picture of data. One tooltip implementation, so the
 *    crosshair on the trend line and the cell readout on the cohort grid feel
 *    like the same object.
 *  - **Every chart has a table.** Colour and position are the presentation;
 *    the numbers themselves are always reachable, which is what makes the
 *    charts safe for anyone the palette fails.
 */

/** Floating readout. Positioned in the chart's own coordinate space. */
export const ChartTooltip: React.FC<{
  x: number;
  y: number;
  /** Flips the anchor before the panel runs off the right edge. */
  width: number;
  children: React.ReactNode;
}> = ({ x, y, width, children }) => {
  const flip = x > width * 0.62;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[132px] rounded-xl border border-hairline bg-surface-solid px-2.5 py-2 shadow-panel"
      style={{
        left: x,
        top: y,
        transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
      }}
    >
      {children}
    </div>
  );
};

export const TooltipTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[11px] font-bold text-ink">{children}</div>
);

/** One `label — value` line, with an optional colour chip for series identity. */
export const TooltipRow: React.FC<{
  label: string;
  value: string;
  swatch?: string;
  muted?: boolean;
}> = ({ label, value, swatch, muted }) => (
  <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
    <span className="flex items-center gap-1.5 text-ink-faint">
      {swatch ? (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: swatch }} />
      ) : null}
      {label}
    </span>
    <span className={muted ? 'font-semibold tabular-nums text-ink-faint' : 'font-bold tabular-nums text-ink'}>
      {value}
    </span>
  </div>
);

/** Legend chip. Present whenever a chart carries more than one kind of mark. */
export const LegendKey: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-faint">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    {label}
  </span>
);

/**
 * Escape hatch from colour and position: the same numbers as rows.
 *
 * Collapsed by default so it never competes with the chart, but always one
 * click away — a WARN on mark contrast is only acceptable when the values are
 * readable some other way, and this is that other way.
 */
export const TableToggle: React.FC<{
  caption: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}> = ({ caption, headers, rows }) => (
  <details className="group mt-3">
    <summary className="cursor-pointer list-none text-[11px] font-semibold text-ink-faint transition-colors hover:text-ink-soft">
      <span className="group-open:hidden">Show {caption} as a table</span>
      <span className="hidden group-open:inline">Hide table</span>
    </summary>
    <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-hairline">
      <table className="w-full text-[11px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-inset">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                scope="col"
                className={`px-2.5 py-1.5 font-bold text-ink-soft ${index === 0 ? 'text-left' : 'text-right'}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-hairline">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-2.5 py-1.5 tabular-nums ${
                    cellIndex === 0 ? 'text-left font-semibold text-ink' : 'text-right text-ink-soft'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

/** Track the pointer inside an SVG plot and report the plot-space x it is over. */
export function usePlotPointer(ref: React.RefObject<HTMLDivElement | null>) {
  const [pointer, setPointer] = React.useState<{ x: number; y: number } | null>(null);

  const handlers = React.useMemo(
    () => ({
      onPointerMove: (event: React.PointerEvent) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      },
      onPointerLeave: () => setPointer(null),
    }),
    [ref]
  );

  return { pointer, handlers };
}

/**
 * Round a maximum up to something an axis can say without embarrassment.
 *
 * The ladder is deliberately fine. A coarse 1/2/5/10 ladder rounds $52K up to
 * $100K and spends half the plot on empty sky, which flattens the very trend
 * the chart exists to show.
 */
const LADDER = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalised = value / magnitude;
  return (LADDER.find((step) => normalised <= step) ?? 10) * magnitude;
}
