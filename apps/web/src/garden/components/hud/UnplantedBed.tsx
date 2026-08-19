import React from 'react';

import { useTheme } from '../../lib/ThemeContext';
import { useReducedMotion } from '../../lib/useReducedMotion';

/**
 * **A bed with three specimens on it, and room for the rest.** The hero of the
 * empty plot.
 *
 * The empty state used to be a sentence on a white card, and a sentence is the
 * wrong thing to meet a product with: the plot's whole pitch is that a business
 * can be *read off a picture*, so the screen that stands where the picture will
 * go should show the picture's vocabulary rather than describe it. This draws
 * the three things a subscription can be on the plot — a paying tree, a failing
 * one in amber, a churned one as a stump — each with its name under it, on the
 * same slab the real beds are drawn on, with a scatter of dashed outlines behind them for the
 * trees that are not here yet.
 *
 * Same rules as `PlantingAnimation`, for the same reasons: the pigments are
 * `theme.canvas` (so it is lit by the season and mode the garden will be), the
 * geometry is the plot's 2:1 isometric, and it grows once on mount and then
 * stands still — `prefers-reduced-motion` skips the growing. The dunning amber
 * comes from `health.yellowing`, which is the *plot's* amber, so the legend is
 * a key to the garden rather than a second palette for the same field.
 *
 * `variant="waiting"` — a connected provider that has answered with no
 * subscriptions — draws the slab and the ghosts only: there is nothing to key,
 * just a bed with nothing in it yet.
 */

/** Half-width and half-height of the slab, in the SVG's own units. */
const W = 150;
const H = 75;
const DEPTH = 22;

/** Isometric projection: the same 2:1 the beds use. */
const iso = (u: number, v: number) => ({
  x: (u - v) * W,
  y: (u + v) * (H / 2),
});

/**
 * The three legend specimens stand on the line `u + v = 1` — the same depth, so
 * they share a baseline and their labels line up under the slab rather than
 * stepping down it.
 */
const SPECIMENS = [
  { kind: 'tree' as const, u: 0.12, v: 0.88, label: 'Paying customer', delay: 0 },
  { kind: 'amber' as const, u: 0.5, v: 0.5, label: 'Failing payment', delay: 0.12 },
  { kind: 'stump' as const, u: 0.88, v: 0.12, label: 'Churned', delay: 0.24 },
];

/** Dashed outlines of trees yet to come — behind and in front of the row. */
const GHOSTS = [
  { u: 0.15, v: 0.45, r: 9 },
  { u: 0.45, v: 0.15, r: 8 },
  { u: 0.1, v: 0.12, r: 7 },
  { u: 0.95, v: 0.62, r: 9 },
  { u: 0.62, v: 0.95, r: 8 },
];

export const UnplantedBed: React.FC<{ variant?: 'legend' | 'waiting' }> = ({ variant = 'legend' }) => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const c = theme.canvas;
  const corners = [iso(0, 0), iso(1, 0), iso(1, 1), iso(0, 1)];
  const legend = variant === 'legend';

  return (
    <svg
      viewBox="-172 -30 344 160"
      className="h-auto w-full max-w-[420px]"
      role="img"
      aria-label={
        legend
          ? 'An empty garden bed with one paying customer drawn as a tree, one failing payment drawn in amber, and one churned customer drawn as a stump'
          : 'An empty garden bed with room for trees'
      }
    >
      {/* The cut earth under the turf: front and side faces, darker than the top. */}
      <polygon
        points={`${corners[3].x},${corners[3].y} ${corners[2].x},${corners[2].y} ${corners[2].x},${corners[2].y + DEPTH} ${corners[3].x},${corners[3].y + DEPTH}`}
        fill={c.soilFront}
      />
      <polygon
        points={`${corners[1].x},${corners[1].y} ${corners[2].x},${corners[2].y} ${corners[2].x},${corners[2].y + DEPTH} ${corners[1].x},${corners[1].y + DEPTH}`}
        fill={c.soilSide}
      />

      {/* Turf, with the plot's checkerboard thinned to furrows. */}
      <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill={c.turfA} />
      {[0.2, 0.4, 0.6, 0.8].map((t) => {
        const a = iso(t, 0);
        const b = iso(t, 1);
        const p = iso(0, t);
        const q = iso(1, t);
        return (
          <g key={t} stroke={c.turfB} strokeWidth={1.2} opacity={0.6}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
          </g>
        );
      })}

      {/* The trees that are not here yet. Dashed, in the leaf's own green, so
          they read as "room to grow" rather than as something wrong. */}
      {GHOSTS.map((g, i) => {
        const { x, y } = iso(g.u, g.v);
        const trunk = 14;
        return (
          <g
            key={i}
            transform={`translate(${x} ${y})`}
            fill="none"
            stroke={c.leaf}
            strokeWidth={1.3}
            strokeDasharray="3 3"
            opacity={0.55}
          >
            <line x1={0} y1={0} x2={0} y2={-trunk} />
            <circle cx={0} cy={-trunk - g.r * 0.7} r={g.r} />
          </g>
        );
      })}

      {legend &&
        SPECIMENS.map((s) => {
          const { x, y } = iso(s.u, s.v);
          const grow = reducedMotion ? undefined : 'garden-grow-once';
          const style = reducedMotion ? undefined : { animationDelay: `${s.delay + 0.15}s` };

          return (
            <g key={s.kind} transform={`translate(${x} ${y})`}>
              {/* Two groups: the outer places, the inner is the only thing the
                  animation touches — see PlantingAnimation for why. */}
              <g className={grow} style={style}>
                <ellipse cx={0} cy={2} rx={13} ry={5} fill={c.groundShadow} />

                {s.kind === 'stump' ? (
                  <>
                    <rect x={-7} y={-9} width={14} height={10} fill={c.stumpBody} />
                    <ellipse cx={0} cy={1} rx={7} ry={3} fill={c.stumpBody} />
                    <ellipse cx={0} cy={-9} rx={7} ry={3} fill={c.stumpTop} />
                    <ellipse cx={0} cy={-9} rx={3.6} ry={1.5} fill="none" stroke={c.stumpBody} strokeWidth={0.8} opacity={0.7} />
                  </>
                ) : (
                  <>
                    <rect x={-2} y={-26} width={4} height={26} rx={1.6} fill={c.trunkPro} />
                    <g fill={s.kind === 'amber' ? c.health.yellowing[0] : c.leaf}>
                      <circle cx={0} cy={-26 - 7.5} r={16} />
                      <circle cx={-10} cy={-26 - 1} r={10.5} />
                      <circle cx={10} cy={-26 - 1} r={10.5} />
                    </g>
                    <circle
                      cx={-5}
                      cy={-26 - 12}
                      r={5.5}
                      fill={s.kind === 'amber' ? c.health.yellowing[1] : c.leafHighlight}
                      opacity={0.85}
                    />
                    {s.kind === 'amber' && (
                      /* Two leaves down: the sprite's own "in trouble" tell, at sketch size. */
                      <g fill={c.health.yellowing[0]} opacity={0.8}>
                        <ellipse cx={16} cy={-4} rx={3} ry={1.6} transform="rotate(-25 16 -4)" />
                        <ellipse cx={-17} cy={-1} rx={3} ry={1.6} transform="rotate(20 -17 -1)" />
                      </g>
                    )}
                  </>
                )}
              </g>

              {/* The label, under the slab at the specimen's own x — a caption
                  row that keys the picture, the way the plot's stakes do. */}
              <text
                x={0}
                y={DEPTH + H / 2 + 19}
                textAnchor="middle"
                className="fill-ink-soft"
                style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.01em' }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
    </svg>
  );
};
