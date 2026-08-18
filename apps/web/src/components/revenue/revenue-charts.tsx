"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Two chart forms, both one series, both drawn as SVG against the app's tokens.
 *
 * The rules they follow, and why:
 *
 * - **One hue, not a categorical palette.** Each chart shows a single measure —
 *   money — so colour has no identity to carry. `--chart-mark` is the one data
 *   pigment (validated for both modes against the card surface); a hue per bar
 *   would invite a reader to decode something that is not there.
 * - **Marks are thin, rounded at the data end only, and anchored to the
 *   baseline**, with a surface-coloured gap between neighbours rather than a
 *   stroke, so bars separate without a second colour.
 * - **Every chart has a hover layer and a table view.** An SVG chart in a
 *   browser is interactive; a value you can only estimate off an axis is a value
 *   the chart is hiding. The hit target is the whole column, not the bar.
 * - **Text never carries the colour.** Labels and values are ink tokens; the
 *   mark beside them is the only thing that is violet.
 * - **Truncation is stated in words**, in the caption, because "the last 12
 *   months we could fetch" and "the last 12 months" are different claims.
 */

export interface Datum {
  label: string;
  /** Sub-label under the tooltip's value — a count, a date, a note. */
  detail?: string;
  value: number;
}

/**
 * React identity for a row or column.
 *
 * **Not the label.** Two customers can share a name, two plans can be called
 * "Pro" at two providers, and a label is data rather than an identifier — keying
 * off it made React drop rows the moment a name repeated. These lists are fully
 * re-derived on every render and never reordered by the user, so the index is the
 * honest key, with the label along for readability in the dev tools.
 */
const keyOf = (datum: Datum, index: number) => `${index}:${datum.label}`;

interface ChartProps {
  title: string;
  data: Datum[];
  format: (value: number) => string;
  caption?: string;
  emptyNote?: string;
}

function useTableToggle() {
  const [asTable, setAsTable] = useState(false);
  return { asTable, setAsTable };
}

function ChartFrame({
  title,
  caption,
  asTable,
  onToggle,
  children,
}: {
  title: string;
  caption?: string;
  asTable: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <figure className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
      {/* `figcaption` has to be the figure's own first child, not wrapped in a
          layout div — the flex row lives on the caption itself. */}
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <span className="block">
          <h3 className="text-xs font-semibold">{title}</h3>
          {caption && <span className="mt-0.5 block text-[10px] text-muted-foreground">{caption}</span>}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={asTable}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-4xl border border-border px-2 py-1 text-[10px] font-medium transition-colors",
            asTable ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Table2 className="size-3" />
          Table
        </button>
      </figcaption>
      {children}
    </figure>
  );
}

function DataTable({ data, format }: { data: Datum[]; format: (value: number) => string }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border/60 text-left text-muted-foreground">
            <th className="py-1 font-medium">Label</th>
            <th className="py-1 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum, index) => (
            <tr key={keyOf(datum, index)} className="border-b border-border/30 last:border-0">
              <td className="py-1">
                {datum.label}
                {datum.detail && (
                  <span className="text-muted-foreground"> · {datum.detail}</span>
                )}
              </td>
              <td className="py-1 text-right font-mono tabular-nums">{format(datum.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ note }: { note: string }) {
  return (
    <p className="flex h-32 items-center justify-center rounded-lg bg-muted/40 px-4 text-center text-[11px] text-muted-foreground">
      {note}
    </p>
  );
}

/* --------------------------------------------------------- vertical columns */

/** Change over time: one column per period, on a shared baseline. */
export function ColumnChart({ title, data, format, caption, emptyNote }: ChartProps) {
  const { asTable, setAsTable } = useTableToggle();
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <ChartFrame title={title} caption={caption} asTable={false} onToggle={() => {}}>
        <Empty note={emptyNote ?? "Nothing to plot yet."} />
      </ChartFrame>
    );
  }

  const width = 100;
  const height = 42;
  const max = Math.max(...data.map((datum) => datum.value), 1);
  const slot = width / data.length;
  // Thin marks: the bar takes a little over half its slot, so the gap between
  // neighbours is surface rather than a stroke.
  const barWidth = Math.min(slot * 0.56, 6);
  const peak = data.reduce((best, datum, index) => (datum.value > data[best].value ? index : best), 0);

  return (
    <ChartFrame
      title={title}
      caption={caption}
      asTable={asTable}
      onToggle={() => setAsTable((value) => !value)}
    >
      {asTable ? (
        <DataTable data={data} format={format} />
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-40 w-full overflow-visible"
            role="img"
            aria-label={`${title}. ${data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}`}
          >
            {/* Recessive grid: three lines, no frame, no ticks. */}
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                x1={0}
                x2={width}
                y1={height * fraction}
                y2={height * fraction}
                className="stroke-border/50"
                strokeWidth={0.2}
              />
            ))}
            <line
              x1={0}
              x2={width}
              y1={height}
              y2={height}
              className="stroke-border"
              strokeWidth={0.3}
            />

            {data.map((datum, index) => {
              const barHeight = Math.max((datum.value / max) * (height - 2), datum.value > 0 ? 0.6 : 0);
              const x = index * slot + (slot - barWidth) / 2;
              const active = hover === index;

              return (
                <g key={keyOf(datum, index)}>
                  <rect
                    x={x}
                    y={height - barHeight}
                    width={barWidth}
                    height={barHeight}
                    // Rounded at the data end only; the baseline stays square.
                    rx={Math.min(barWidth / 2, 1.2)}
                    className={cn("fill-chart-mark transition-opacity", hover !== null && !active && "opacity-45")}
                  />
                  {/* The hit target is the whole column, not the mark. */}
                  <rect
                    x={index * slot}
                    y={0}
                    width={slot}
                    height={height}
                    fill="transparent"
                    onMouseEnter={() => setHover(index)}
                    onMouseLeave={() => setHover((current) => (current === index ? null : current))}
                  />
                </g>
              );
            })}
          </svg>

          {/* One direct label — the peak. A number on every bar is noise. */}
          <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
            <span>{data[0].label}</span>
            <span className="font-medium text-foreground">
              peak {data[peak].label} · {format(data[peak].value)}
            </span>
            <span>{data[data.length - 1].label}</span>
          </div>

          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-card px-2 py-1 text-[10px] shadow-elev-2"
              role="status"
            >
              <span className="font-medium">{data[hover].label}</span>
              <span className="mx-1 text-muted-foreground">·</span>
              <span className="font-mono tabular-nums">{format(data[hover].value)}</span>
              {data[hover].detail && (
                <span className="ml-1 text-muted-foreground">{data[hover].detail}</span>
              )}
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------ line over time */

/**
 * A quantity over time: one series, one hue, no legend — the title names it.
 *
 * The line is 2px, the area under it is the same hue at low opacity (a fill, not
 * a second colour), and the hover layer is a crosshair rather than per-point dots:
 * on a monthly series the reader wants "what was it in March", and asking them to
 * hit an 8px circle to find out is a puzzle.
 */
export function LineChart({ title, data, format, caption, emptyNote }: ChartProps) {
  const { asTable, setAsTable } = useTableToggle();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <ChartFrame title={title} caption={caption} asTable={false} onToggle={() => {}}>
        <Empty note={emptyNote ?? "Two months of history are needed to draw a line."} />
      </ChartFrame>
    );
  }

  const width = 100;
  const height = 42;
  const max = Math.max(...data.map((datum) => datum.value), 1);
  const min = Math.min(...data.map((datum) => datum.value), 0);
  const span = max - min || 1;
  const x = (index: number) => (index / (data.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / span) * (height - 2) - 1;

  const line = data.map((datum, index) => `${x(index)},${y(datum.value)}`).join(" ");
  const area = `${x(0)},${height} ${line} ${x(data.length - 1)},${height}`;
  const last = data[data.length - 1];

  return (
    <ChartFrame
      title={title}
      caption={caption}
      asTable={asTable}
      onToggle={() => setAsTable((value) => !value)}
    >
      {asTable ? (
        <DataTable data={data} format={format} />
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-40 w-full overflow-visible"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${title}. ${data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}`}
          >
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line
                key={fraction}
                x1={0}
                x2={width}
                y1={height * fraction}
                y2={height * fraction}
                className="stroke-border/50"
                strokeWidth={0.2}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <polygon points={area} className="fill-chart-mark/15" />
            <polyline
              points={line}
              fill="none"
              className="stroke-chart-mark"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              // Without this the 2px line is scaled by the viewBox and comes out
              // as a smear at one aspect ratio and a hair at another.
              vectorEffect="non-scaling-stroke"
            />

            {hover !== null && (
              <>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={0}
                  y2={height}
                  className="stroke-foreground/30"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={x(hover)}
                  cy={y(data[hover].value)}
                  r={4}
                  className="fill-chart-mark stroke-card"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}

            {/* One hit band per point, full height, so the crosshair is easy to
                land on with a mouse and with a coarse pointer. */}
            {data.map((datum, index) => (
              <rect
                key={keyOf(datum, index)}
                x={index === 0 ? 0 : x(index) - width / (data.length - 1) / 2}
                y={0}
                width={width / (data.length - 1)}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover((current) => (current === index ? null : current))}
              />
            ))}
          </svg>

          <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
            <span>{data[0].label}</span>
            <span className="font-medium text-foreground">
              now {format(last.value)}
            </span>
          </div>

          {hover !== null && (
            <div
              className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-card px-2 py-1 text-[10px] shadow-elev-2"
              role="status"
            >
              <span className="font-medium">{data[hover].label}</span>
              <span className="mx-1 text-muted-foreground">·</span>
              <span className="font-mono tabular-nums">{format(data[hover].value)}</span>
              {data[hover].detail && (
                <span className="ml-1 text-muted-foreground">{data[hover].detail}</span>
              )}
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------ gained vs lost */

export interface Movement {
  label: string;
  gained: number;
  lost: number;
}

/**
 * Polarity over time: gained above the zero line, lost below it.
 *
 * Three encodings carry the sign, not one — **position** (which side of the
 * line), **a legend with the words on it**, and a diverging hue pair that is
 * cool/warm rather than green/red, because green and red at equal lightness are
 * ~5 ΔE apart for a deuteranope and the validator rejects them. A reader who sees
 * no colour at all still reads this chart correctly.
 */
export function MovementChart({
  title,
  data,
  caption,
  gainedLabel = "Gained",
  lostLabel = "Lost",
}: {
  title: string;
  data: Movement[];
  caption?: string;
  gainedLabel?: string;
  lostLabel?: string;
}) {
  const { asTable, setAsTable } = useTableToggle();
  const [hover, setHover] = useState<number | null>(null);

  const peak = Math.max(...data.map((d) => Math.max(d.gained, d.lost)), 1);

  if (!data.length) {
    return (
      <ChartFrame title={title} caption={caption} asTable={false} onToggle={() => {}}>
        <Empty note="No movement in the months fetched." />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title={title}
      caption={caption}
      asTable={asTable}
      onToggle={() => setAsTable((value) => !value)}
    >
      {asTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border/60 text-left text-muted-foreground">
                <th className="py-1 font-medium">Month</th>
                <th className="py-1 text-right font-medium">{gainedLabel}</th>
                <th className="py-1 text-right font-medium">{lostLabel}</th>
                <th className="py-1 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.map((datum, index) => (
                <tr key={`${index}:${datum.label}`} className="border-b border-border/30 last:border-0">
                  <td className="py-1">{datum.label}</td>
                  <td className="py-1 text-right tabular-nums">{datum.gained}</td>
                  <td className="py-1 text-right tabular-nums">{datum.lost}</td>
                  <td className="py-1 text-right tabular-nums">
                    {datum.gained - datum.lost > 0 ? "+" : ""}
                    {datum.gained - datum.lost}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Two series, so a legend is not optional. */}
          <div className="mb-2 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-chart-gain" />
              {gainedLabel}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-sm bg-chart-loss" />
              {lostLabel}
            </span>
          </div>

          <div className="relative flex h-40 items-stretch gap-[2px]">
            {data.map((datum, index) => {
              const active = hover === index;
              return (
                <div
                  key={`${index}:${datum.label}`}
                  className="relative flex flex-1 flex-col justify-center"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover((current) => (current === index ? null : current))}
                >
                  <div className="flex h-1/2 flex-col justify-end">
                    <div
                      className={cn(
                        "rounded-t bg-chart-gain transition-opacity",
                        hover !== null && !active && "opacity-45",
                      )}
                      style={{ height: `${(datum.gained / peak) * 100}%` }}
                    />
                  </div>
                  {/* The zero line is the only rule in the chart. */}
                  <div className="h-px bg-border" />
                  <div className="flex h-1/2 flex-col justify-start">
                    <div
                      className={cn(
                        "rounded-b bg-chart-loss transition-opacity",
                        hover !== null && !active && "opacity-45",
                      )}
                      style={{ height: `${(datum.lost / peak) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {hover !== null && (
              <div
                className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-card px-2 py-1 text-[10px] shadow-elev-2"
                role="status"
              >
                <span className="font-medium">{data[hover].label}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="tabular-nums">
                  +{data[hover].gained} {gainedLabel.toLowerCase()}, −{data[hover].lost}{" "}
                  {lostLabel.toLowerCase()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-1.5 flex justify-between text-[9px] text-muted-foreground">
            <span>{data[0].label}</span>
            <span>{data[data.length - 1].label}</span>
          </div>
        </>
      )}
    </ChartFrame>
  );
}

/* ------------------------------------------------------------- status shares */

/**
 * One bar, split by state, every segment labelled.
 *
 * Status colours are the reserved four and they never travel without their word —
 * that is the rule that keeps them out of the categorical set. Segments are
 * separated by a surface gap rather than a stroke.
 */
export function StatusBar({
  title,
  caption,
  segments,
}: {
  title: string;
  caption?: string;
  segments: Array<{ label: string; count: number; tone: "good" | "warn" | "bad" | "muted" }>;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  const FILL = {
    good: "bg-success",
    warn: "bg-warn",
    bad: "bg-destructive",
    muted: "bg-muted-foreground/40",
  } as const;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-elev-1">
      <h3 className="text-xs font-semibold">{title}</h3>
      {caption && <p className="mt-0.5 text-[10px] text-muted-foreground">{caption}</p>}

      {total === 0 ? (
        <Empty note="Nothing to split yet." />
      ) : (
        <>
          <div className="mt-3 flex h-3 gap-[2px] overflow-hidden rounded-4xl">
            {segments
              .filter((segment) => segment.count > 0)
              .map((segment, index) => (
                <div
                  key={`${index}:${segment.label}`}
                  className={FILL[segment.tone]}
                  style={{ width: `${(segment.count / total) * 100}%` }}
                  title={`${segment.label}: ${segment.count}`}
                />
              ))}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {segments.map((segment, index) => (
              <div key={`${index}:${segment.label}`} className="flex items-center gap-1.5">
                <span className={cn("size-2 shrink-0 rounded-sm", FILL[segment.tone])} />
                <dt className="text-[10px] text-muted-foreground">{segment.label}</dt>
                <dd className="ml-auto font-mono text-[11px] font-semibold tabular-nums">
                  {segment.count}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ cohort triangle */

/**
 * Retention by signup cohort: one row per month, one column per month of life.
 *
 * A **sequential single-hue ramp** — magnitude, so one hue, light to dark, built
 * with `color-mix` against the card so it anchors on white in light mode and on
 * near-black in dark rather than being an alpha wash that looks grey on one of
 * them. Cells past today are empty, not zero: a cohort three months old has no
 * fourth month yet, and drawing one as 0% retention is a lie about the business.
 */
export function CohortGrid({
  title,
  caption,
  rows,
}: {
  title: string;
  caption?: string;
  rows: Array<{ label: string; size: number; retention: Array<number | null> }>;
}) {
  const [asTable, setAsTable] = useState(false);
  const width = rows[0]?.retention.length ?? 0;

  if (!rows.length || !width) {
    return (
      <ChartFrame title={title} caption={caption} asTable={false} onToggle={() => {}}>
        <Empty note="No cohorts yet — that needs at least one month of signups." />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title={title}
      caption={caption}
      asTable={asTable}
      onToggle={() => setAsTable((value) => !value)}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium">Cohort</th>
              <th className="text-right font-medium">Size</th>
              {Array.from({ length: width }, (_, index) => (
                <th key={index} className="text-center font-medium">
                  m{index}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}:${row.label}`}>
                <td className="whitespace-nowrap pr-2 text-muted-foreground">{row.label}</td>
                <td className="pr-2 text-right font-mono tabular-nums">{row.size}</td>
                {row.retention.map((value, index) => (
                  <td
                    key={index}
                    // The number is in every cell that has one: a heatmap whose
                    // values are only in a tooltip is a picture, not a table.
                    className={cn(
                      "h-6 rounded text-center tabular-nums",
                      value === null && "bg-muted/30 text-transparent",
                      value !== null && value > 0.6 ? "text-white" : "text-foreground",
                    )}
                    style={
                      value === null
                        ? undefined
                        : {
                            backgroundColor: `color-mix(in oklab, var(--chart-mark) ${Math.round(
                              value * 100,
                            )}%, var(--card))`,
                          }
                    }
                    title={
                      value === null
                        ? "Not reached yet"
                        : `${row.label}, month ${index}: ${Math.round(value * 100)}% still active`
                    }
                  >
                    {value === null
                      ? "–"
                      : asTable
                        ? `${Math.round(value * 100)}%`
                        : value >= 0.995
                          ? "100"
                          : Math.round(value * 100)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}

/* ------------------------------------------------------- horizontal rows */

/** Magnitude by identity: a row per category, each directly labelled. */
export function RowChart({ title, data, format, caption, emptyNote }: ChartProps) {
  const { asTable, setAsTable } = useTableToggle();
  // By index, not by label: with two rows sharing a name, hovering one used to
  // light up both.
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return (
      <ChartFrame title={title} caption={caption} asTable={false} onToggle={() => {}}>
        <Empty note={emptyNote ?? "Nothing to plot yet."} />
      </ChartFrame>
    );
  }

  const max = Math.max(...data.map((datum) => datum.value), 1);

  return (
    <ChartFrame
      title={title}
      caption={caption}
      asTable={asTable}
      onToggle={() => setAsTable((value) => !value)}
    >
      {asTable ? (
        <DataTable data={data} format={format} />
      ) : (
        <ul className="space-y-2">
          {data.map((datum, index) => {
            const share = Math.max((datum.value / max) * 100, datum.value > 0 ? 1.5 : 0);
            const active = hover === index;

            return (
              <li
                key={keyOf(datum, index)}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover((current) => (current === index ? null : current))}
              >
                <div className="flex items-baseline justify-between gap-3 text-[11px]">
                  <span className="truncate font-medium">{datum.label}</span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {format(datum.value)}
                    {datum.detail && <span className="ml-1">· {datum.detail}</span>}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-4xl bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-4xl bg-chart-mark transition-opacity",
                      hover !== null && !active && "opacity-45",
                    )}
                    style={{ width: `${share}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ChartFrame>
  );
}
