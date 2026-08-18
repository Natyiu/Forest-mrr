import React from 'react';
import { type MrrMovement } from '../../lib/metrics';
import { money, signedMoney } from '../../lib/format';
import { ChartTooltip, LegendKey, TableToggle, TooltipRow, TooltipTitle, niceCeiling, usePlotPointer } from './chartUi';

/**
 * The five ways a month's revenue moved, plus the long tail.
 *
 * Drawn from a zero baseline rather than as a stacked waterfall on top of the
 * opening balance. On a book worth $49,000 that moves by $600, a true waterfall
 * renders every movement as a hairline against two enormous end columns — the
 * shape is honest and completely unreadable. Sharing a zero baseline makes the
 * movements comparable to each other, which is the only comparison anybody
 * makes here, and the opening and closing balances are stated in words above.
 *
 * A movement that was zero still gets a column and a labelled `$0`: "measured,
 * and nothing happened" is information, and hiding it would make an empty month
 * look like a month with fewer things in it.
 */

interface MovementChartProps {
  movement: MrrMovement;
  height?: number;
}

type Kind = 'gain' | 'loss' | 'total';

const COLORS: Record<Kind, string> = {
  gain: 'var(--garden)',
  loss: 'var(--danger)',
  total: 'var(--ink-faint)',
};

const PADDING = { top: 22, bottom: 34 };
const MAX_BAR = 24;

export const MovementChart: React.FC<MovementChartProps> = ({ movement, height = 190 }) => {
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

  const bars: Array<{ label: string; value: number; kind: Kind; note: string }> = [
    { label: 'New', value: movement.new, kind: 'gain', note: 'First-time subscriptions' },
    { label: 'Expansion', value: movement.expansion, kind: 'gain', note: 'Upgrades on existing accounts' },
    { label: 'Reactivation', value: movement.reactivation, kind: 'gain', note: 'Returning after cancelling' },
    { label: 'Contraction', value: -movement.contraction, kind: 'loss', note: 'Downgrades on existing accounts' },
    { label: 'Churn', value: -movement.churn, kind: 'loss', note: 'Subscriptions that left' },
    {
      label: 'Meadow',
      value: movement.meadow,
      kind: movement.meadow < 0 ? 'loss' : 'gain',
      note: 'Net movement of the long tail',
    },
    { label: 'Net', value: movement.net, kind: 'total', note: 'Everything above, summed' },
  ];

  const extent = niceCeiling(Math.max(1, ...bars.map((bar) => Math.abs(bar.value))));
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const zeroY = PADDING.top + plotHeight / 2;
  const band = width / bars.length;
  const barWidth = Math.min(MAX_BAR, band - 14);

  const centreOf = (index: number) => band * (index + 0.5);
  const lengthOf = (value: number) => (Math.abs(value) / extent) * (plotHeight / 2);

  const hovered =
    pointer && band > 0 ? Math.max(0, Math.min(bars.length - 1, Math.floor(pointer.x / band))) : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[12px] text-ink-soft">
          <span className="font-semibold text-ink">{money(movement.starting)}</span> at the start of{' '}
          {movement.label} →{' '}
          <span className="font-semibold text-ink">{money(movement.ending)}</span> at the close
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <LegendKey label="Gain" color={COLORS.gain} />
          <LegendKey label="Loss" color={COLORS.loss} />
          <LegendKey label="Net" color={COLORS.total} />
        </div>
      </div>

      <div ref={wrapRef} className="relative mt-1 select-none" style={{ height }} {...handlers}>
        <svg width={width} height={height}>
          <line
            x1={0}
            x2={width}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--hairline)"
            strokeWidth={1}
          />

          {bars.map((bar, index) => {
            const centre = centreOf(index);
            const length = lengthOf(bar.value);
            const up = bar.value >= 0;
            const x = centre - barWidth / 2;
            const isHovered = hovered === index;

            return (
              <g key={bar.label} opacity={hovered === null || isHovered ? 1 : 0.55}>
                {Math.round(bar.value) === 0 ? (
                  // Measured, and nothing happened.
                  <rect x={x} y={zeroY - 1} width={barWidth} height={2} rx={1} fill="var(--ink-faint)" opacity={0.5} />
                ) : (
                  <path
                    // Rounded at the data end, square where it meets the baseline.
                    d={
                      up
                        ? `M${x},${zeroY} L${x},${zeroY - length + 4} Q${x},${zeroY - length} ${x + 4},${zeroY - length} L${
                            x + barWidth - 4
                          },${zeroY - length} Q${x + barWidth},${zeroY - length} ${x + barWidth},${zeroY - length + 4} L${
                            x + barWidth
                          },${zeroY} Z`
                        : `M${x},${zeroY} L${x},${zeroY + length - 4} Q${x},${zeroY + length} ${x + 4},${zeroY + length} L${
                            x + barWidth - 4
                          },${zeroY + length} Q${x + barWidth},${zeroY + length} ${x + barWidth},${zeroY + length - 4} L${
                            x + barWidth
                          },${zeroY} Z`
                    }
                    fill={COLORS[bar.kind]}
                  />
                )}

                {/* Direct value label — also the relief channel for the amber-
                    adjacent contrast warning on light surfaces. */}
                <text
                  x={centre}
                  y={up ? zeroY - length - 7 : zeroY + length + 14}
                  textAnchor="middle"
                  className={`text-[10px] font-bold tabular-nums ${
                    Math.round(bar.value) === 0 ? 'fill-[var(--ink-faint)]' : 'fill-[var(--ink)]'
                  }`}
                >
                  {signedMoney(bar.value)}
                </text>

                <text
                  x={centre}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-[var(--ink-faint)] text-[10px] font-semibold"
                >
                  {bar.label}
                </text>
              </g>
            );
          })}
        </svg>

        {pointer && hovered !== null && (
          <ChartTooltip x={centreOf(hovered)} y={zeroY} width={width}>
            <TooltipTitle>{bars[hovered].label}</TooltipTitle>
            <TooltipRow
              label={movement.label}
              value={signedMoney(bars[hovered].value)}
              swatch={COLORS[bars[hovered].kind]}
            />
            <p className="mt-1.5 max-w-[168px] text-[10px] leading-snug text-ink-faint">{bars[hovered].note}</p>
          </ChartTooltip>
        )}
      </div>

      <TableToggle
        caption="revenue movement"
        headers={['Movement', 'Amount']}
        rows={[
          ['Starting MRR', money(movement.starting)],
          ...bars.map((bar) => [bar.label, signedMoney(bar.value)] as Array<string | number>),
          ['Ending MRR', money(movement.ending)],
        ]}
      />
    </div>
  );
};
