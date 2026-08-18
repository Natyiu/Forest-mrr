import React from 'react';
import { type HistoricalSnapshot } from '../../types';
import { compactMoney, count, money } from '../../lib/format';
import { monthLabel } from '../../lib/metrics';
import { ChartTooltip, TableToggle, TooltipRow, TooltipTitle, niceCeiling, usePlotPointer } from './chartUi';

/**
 * Revenue over the life of the business.
 *
 * One series, so no legend — the title says what is plotted, and a second
 * measure would need a second y-axis, which is the fastest way to make a chart
 * lie. Subscriber count rides in the tooltip instead of on a rival scale.
 *
 * The month the timeline is scrubbed to is marked, and clicking anywhere on the
 * plot scrubs to that month: the chart is a control, not an illustration.
 */

interface TrendChartProps {
  snapshots: HistoricalSnapshot[];
  /** Index of the month the rest of the app is showing. */
  activeIndex: number;
  onScrub?: (index: number) => void;
  height?: number;
}

const PADDING = { top: 14, right: 16, bottom: 22, left: 46 };

export const TrendChart: React.FC<TrendChartProps> = ({
  snapshots,
  activeIndex,
  onScrub,
  height = 172,
}) => {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(560);
  const { pointer, handlers } = usePlotPointer(wrapRef);

  React.useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const observe = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observe.observe(element);
    return () => observe.disconnect();
  }, []);

  const plotWidth = Math.max(80, width - PADDING.left - PADDING.right);
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const ceiling = niceCeiling(Math.max(...snapshots.map((s) => s.mrr)));
  const stepX = snapshots.length > 1 ? plotWidth / (snapshots.length - 1) : 0;

  const xOf = (index: number) => PADDING.left + index * stepX;
  const yOf = (value: number) => PADDING.top + (1 - value / ceiling) * plotHeight;

  const line = snapshots
    .map((snap, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(snap.mrr).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${xOf(snapshots.length - 1).toFixed(1)},${PADDING.top + plotHeight} L${PADDING.left},${
    PADDING.top + plotHeight
  } Z`;

  // Nearest month to the pointer, which is what a crosshair should snap to.
  const hoveredIndex =
    pointer && stepX > 0
      ? Math.max(0, Math.min(snapshots.length - 1, Math.round((pointer.x - PADDING.left) / stepX)))
      : null;

  const readIndex = hoveredIndex ?? activeIndex;
  const readSnapshot = snapshots[readIndex];

  const ticks = [0, 0.5, 1].map((fraction) => ({
    value: ceiling * fraction,
    y: yOf(ceiling * fraction),
  }));

  // Roughly one x label per 90px. Counted *backwards* from the last month so
  // the right-hand label is always present and never lands on top of its
  // neighbour — stepping forwards from January leaves whatever gap is left over
  // at the end, and two dates then overprint each other.
  const labelEvery = Math.max(1, Math.ceil(snapshots.length / Math.max(2, Math.floor(plotWidth / 90))));
  const labelled = new Set<number>();
  for (let index = snapshots.length - 1; index >= 0; index -= labelEvery) labelled.add(index);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative select-none"
        style={{ height }}
        {...handlers}
        onClick={() => hoveredIndex !== null && onScrub?.(hoveredIndex)}
        role={onScrub ? 'slider' : undefined}
        aria-label={onScrub ? 'Scrub the timeline' : undefined}
        aria-valuemin={0}
        aria-valuemax={snapshots.length - 1}
        aria-valuenow={activeIndex}
        aria-valuetext={monthLabel(snapshots[activeIndex])}
      >
        <svg width={width} height={height} className={onScrub ? 'cursor-pointer' : undefined}>
          {ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--hairline)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-[var(--ink-faint)] text-[10px] tabular-nums"
              >
                {compactMoney(tick.value)}
              </text>
            </g>
          ))}

          <path d={area} fill="var(--garden)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--garden)" strokeWidth={2} strokeLinejoin="round" />

          {/* Where the rest of the app is standing. */}
          <line
            x1={xOf(activeIndex)}
            x2={xOf(activeIndex)}
            y1={PADDING.top}
            y2={PADDING.top + plotHeight}
            stroke="var(--garden-line)"
            strokeWidth={2}
          />

          {hoveredIndex !== null && hoveredIndex !== activeIndex && (
            <line
              x1={xOf(hoveredIndex)}
              x2={xOf(hoveredIndex)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
          )}

          <circle
            cx={xOf(readIndex)}
            cy={yOf(readSnapshot.mrr)}
            r={4}
            fill="var(--garden)"
            stroke="var(--surface-solid)"
            strokeWidth={2}
          />

          {snapshots.map((snap, index) =>
            labelled.has(index) ? (
              <text
                key={snap.dateStr}
                x={xOf(index)}
                y={height - 6}
                textAnchor={
                  index === snapshots.length - 1 ? 'end' : xOf(index) < PADDING.left + 14 ? 'start' : 'middle'
                }
                className="fill-[var(--ink-faint)] text-[10px]"
              >
                {monthLabel(snap)}
              </text>
            ) : null
          )}
        </svg>

        {pointer && hoveredIndex !== null && (
          <ChartTooltip x={xOf(hoveredIndex)} y={yOf(snapshots[hoveredIndex].mrr)} width={width}>
            <TooltipTitle>{monthLabel(snapshots[hoveredIndex])}</TooltipTitle>
            <TooltipRow label="MRR" value={money(snapshots[hoveredIndex].mrr)} swatch="var(--garden)" />
            <TooltipRow label="Subscribers" value={count(snapshots[hoveredIndex].activeCount)} muted />
            <TooltipRow label="At risk" value={count(snapshots[hoveredIndex].atRiskCount)} muted />
          </ChartTooltip>
        )}
      </div>

      <TableToggle
        caption="monthly revenue"
        headers={['Month', 'MRR', 'Subscribers', 'At risk']}
        rows={snapshots
          .slice()
          .reverse()
          .map((snap) => [monthLabel(snap), money(snap.mrr), count(snap.activeCount), count(snap.atRiskCount)])}
      />
    </div>
  );
};
