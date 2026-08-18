import React from 'react';
import { type CohortRow } from '../../lib/metrics';
import { useTheme } from '../../lib/ThemeContext';
import { count, money, percent } from '../../lib/format';

/**
 * The retention triangle: cohorts down, months since signup across.
 *
 * Colour is doing *magnitude* here, not identity, so it is one hue stepped by
 * lightness rather than a set of distinct hues — mixed against the panel's own
 * surface, which means the ramp anchors on white in light mode and on near
 * black in dark, and stays monotone in both without a second palette.
 *
 * Revenue retention is the default because it is the only view that can exceed
 * 100%: a cohort whose upgrades outrun its cancellations is the single most
 * important thing a subscription business can see about itself, and a logo
 * count structurally cannot show it. The toggle is right there for the sanity
 * check.
 */

interface RetentionGridProps {
  rows: CohortRow[];
  mode: 'revenue' | 'logos';
  onModeChange: (mode: 'revenue' | 'logos') => void;
  /** Cap on columns and rows, so a three-year book stays a readable grid. */
  maxPeriods?: number;
  maxCohorts?: number;
}

/**
 * Position on the single-hue ramp.
 *
 * The domain runs to 120%, not 100%, so a cohort that expanded past its
 * starting value is visibly darker than one that merely held on to it. Clamped
 * at 100% of the ramp they would be the same colour, and the chart would hide
 * the one outcome it is best placed to reveal. Floored at the bottom so a live
 * cohort never reads as an empty cell.
 */
const RAMP_TOP = 1.2;

/**
 * Where along the ramp the label has to flip.
 *
 * Not the same point in both modes, and not the midpoint in either. In light
 * the ramp runs white → accent, so `accent-ink` (white) only clears contrast
 * near the top; in dark it runs near-black → a bright accent, so ink stops
 * working much sooner. Splitting the difference at 50% would leave a band of
 * unreadable cells in both.
 */
const INK_FLIP: Record<'light' | 'dark', number> = { light: 0.85, dark: 0.55 };

function cellStyle(value: number, mode: 'light' | 'dark'): React.CSSProperties {
  const strength = Math.max(0.08, Math.min(1, value / RAMP_TOP));
  return {
    background: `color-mix(in oklab, var(--garden) ${Math.round(strength * 92)}%, var(--surface-solid))`,
    color: strength > INK_FLIP[mode] ? 'var(--garden-ink)' : 'var(--ink)',
  };
}

export const RetentionGrid: React.FC<RetentionGridProps> = ({
  rows,
  mode,
  onModeChange,
  maxPeriods = 13,
  maxCohorts = 18,
}) => {
  const { resolvedMode } = useTheme();
  const shown = rows.slice(0, maxCohorts);
  const columns = Math.min(maxPeriods, Math.max(...shown.map((row) => row.periods.length), 1));
  const hiddenCohorts = rows.length - shown.length;
  const hiddenPeriods = Math.max(0, Math.max(...rows.map((row) => row.periods.length), 0) - columns);

  // Average retention per column, over the cohorts old enough to have one.
  const averages = Array.from({ length: columns }, (_, offset) => {
    const values = rows.map((row) => row.periods[offset]).filter((value) => value !== undefined);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(['revenue', 'logos'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onModeChange(option)}
              aria-pressed={mode === option}
              className={`rounded-full px-3 py-1 text-[11px] font-bold capitalize transition-colors cursor-pointer ${
                mode === option ? 'bg-garden text-garden-ink' : 'bg-inset text-ink-soft hover:bg-inset-strong'
              }`}
            >
              {option === 'revenue' ? 'Revenue retention' : 'Logo retention'}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-ink-faint">
          {mode === 'revenue'
            ? 'Above 100% means the cohort grew — expansion beat churn.'
            : 'Share of the cohort still subscribed.'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[10px]">
          <caption className="sr-only">
            {mode === 'revenue' ? 'Revenue' : 'Logo'} retention by signup cohort and months since signup
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface-solid px-2 text-left font-bold text-ink-faint">
                Cohort
              </th>
              <th scope="col" className="px-2 text-right font-bold text-ink-faint">
                Size
              </th>
              {Array.from({ length: columns }, (_, offset) => (
                <th key={offset} scope="col" className="w-11 text-center font-bold text-ink-faint">
                  m{offset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.cohort}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-surface-solid px-2 text-left font-bold text-ink"
                >
                  {row.label}
                </th>
                <td className="whitespace-nowrap px-2 text-right tabular-nums text-ink-faint">
                  {mode === 'revenue' ? money(row.startingMrr) : count(row.logos)}
                </td>
                {Array.from({ length: columns }, (_, offset) => {
                  const value = row.periods[offset];
                  if (value === undefined) {
                    return <td key={offset} className="rounded-lg bg-inset/40" />;
                  }
                  return (
                    <td
                      key={offset}
                      title={`${row.label}, month ${offset}: ${percent(value, 0)}`}
                      className="rounded-lg py-1 text-center font-bold tabular-nums"
                      style={cellStyle(value, resolvedMode)}
                    >
                      {percent(value, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-surface-solid px-2 text-left font-bold text-ink-faint">
                Average
              </th>
              <td />
              {averages.map((average, offset) => (
                <td key={offset} className="pt-1 text-center font-bold tabular-nums text-ink-soft">
                  {average === null ? '' : percent(average, 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {(hiddenCohorts > 0 || hiddenPeriods > 0) && (
        <p className="text-[11px] text-ink-faint">
          Showing the {shown.length} most recent cohorts to month {columns - 1}
          {hiddenCohorts > 0 ? ` · ${hiddenCohorts} older ${hiddenCohorts === 1 ? 'cohort' : 'cohorts'} not shown` : ''}
          {hiddenPeriods > 0 ? ` · ${hiddenPeriods} later ${hiddenPeriods === 1 ? 'month' : 'months'} not shown` : ''}.
        </p>
      )}
    </div>
  );
};
