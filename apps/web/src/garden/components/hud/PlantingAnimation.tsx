import React from 'react';

import { useTheme } from '../../lib/ThemeContext';
import { useReducedMotion } from '../../lib/useReducedMotion';

/**
 * **A bed, and trees coming up on it.** The loading state, and the only one.
 *
 * It draws the same scene the plot does — an isometric slab with a soil edge, turf
 * in two tones, and canopies over bare trunks — because a spinner tells you the app
 * is busy while this tells you *what it is busy doing*: planting your book. The
 * waiting is the same length either way; only one of them is about the product.
 *
 * Three things keep it honest rather than decorative:
 *
 * - **The pigments are the plot's.** Turf, soil, bark and foliage come from
 *   `theme.canvas`, so the loader is lit by the same season and mode the garden is
 *   about to be. A hand-picked green here would drift the first time a season is
 *   retuned, and the reader would meet two different products a second apart.
 * - **The geometry is the plot's.** The same 2:1 isometric ratio the beds are drawn
 *   in, so the shape you watch grow is the shape that arrives.
 * - **It stops for `prefers-reduced-motion`.** The trees are then simply *there*,
 *   fully grown — the scene still says "planting", it just does not move.
 */

/** Half-width and half-height of the slab, in the SVG's own units. */
const W = 150;
const H = 75;

/**
 * A bed of trees, on the grid the real plot plants on.
 *
 * Rows and columns rather than four scattered specimens, because the thing being
 * waited for is a *bed filling up*, and four trees read as an illustration of a tree.
 *
 * Two rules come straight from the plot and are worth keeping here:
 *
 * - **Depth order.** In this projection `u + v` grows towards the viewer, so the list
 *   is sorted by it and painted in that order — a nearer canopy overlaps a farther
 *   one, which is the whole reason the scene looks solid rather than flat.
 * - **The wave follows the same axis.** Delay is a function of `u + v`, so the bed
 *   plants from the back corner forward instead of all at once or left to right,
 *   which is what makes it read as depth rather than as a row of bars.
 *
 * Sizes vary deterministically — no `Math.random`, so the same bed is drawn every
 * time and nothing depends on when the component happened to mount.
 */
const COLS = 5;
const ROWS = 4;

const TREES = Array.from({ length: COLS * ROWS }, (_, index) => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const u = (col + 0.5) / COLS;
  const v = (row + 0.5) / ROWS;

  return {
    u,
    v,
    // 0.5–0.85, cycling on a prime-ish stride so neighbours differ but the bed
    // never looks noisy.
    scale: 0.5 + (((col * 3 + row * 5) % 6) / 6) * 0.35,
    // The whole sweep fits inside the first quarter of the cycle, so the bed
    // spends most of it full rather than most of it filling.
    delay: (u + v) * 0.4,
  };
}).sort((a, b) => a.u + a.v - (b.u + b.v));

/** Isometric projection: the same 2:1 the beds use. */
const iso = (u: number, v: number) => ({
  x: (u - v) * W,
  y: (u + v) * (H / 2),
});

export const PlantingAnimation: React.FC = () => {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const c = theme.canvas;

  const corners = [iso(0, 0), iso(1, 0), iso(1, 1), iso(0, 1)];
  const depth = 22;

  return (
    <svg
      viewBox="-168 -46 336 210"
      className="h-[168px] w-[290px]"
      role="img"
      aria-label="Planting your garden"
    >
      {/* The cut earth under the turf: front and side faces, darker than the top. */}
      <polygon
        points={`${corners[3].x},${corners[3].y} ${corners[2].x},${corners[2].y} ${corners[2].x},${corners[2].y + depth} ${corners[3].x},${corners[3].y + depth}`}
        fill={c.soilFront}
      />
      <polygon
        points={`${corners[1].x},${corners[1].y} ${corners[2].x},${corners[2].y} ${corners[2].x},${corners[2].y + depth} ${corners[1].x},${corners[1].y + depth}`}
        fill={c.soilSide}
      />

      {/* Turf. */}
      <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} fill={c.turfA} />

      {/* Four furrows in the second tone — the plot's checkerboard, thinned to a
          hint so it reads as ground rather than as a chart. */}
      {Array.from({ length: COLS - 1 }, (_, i) => (i + 1) / COLS).map((u) => {
        const a = iso(u, 0);
        const b = iso(u, 1);
        return (
          <line key={`u${u}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.turfB} strokeWidth={1.2} opacity={0.6} />
        );
      })}
      {Array.from({ length: ROWS - 1 }, (_, i) => (i + 1) / ROWS).map((v) => {
        const a = iso(0, v);
        const b = iso(1, v);
        return (
          <line key={`v${v}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c.turfB} strokeWidth={1.2} opacity={0.6} />
        );
      })}

      {TREES.map((tree) => {
        const { x, y } = iso(tree.u, tree.v);
        const trunk = 24 * tree.scale;
        const canopy = 15 * tree.scale;

        return (
          /*
            **Two groups, and they must stay two.**

            The outer one places the tree; the inner one is the only thing the
            animation touches. A CSS `transform` on an element *replaces* its
            `transform` presentation attribute rather than composing with it — so
            when the growth animation and the `translate()` were on the same `<g>`,
            every tree in the bed lost its position the moment the animation began
            and the whole planting collapsed onto the origin. Twenty trees drawn
            exactly on top of each other read as one tree, which is precisely what
            it looked like.
          */
          <g key={`${tree.u}-${tree.v}`} transform={`translate(${x} ${y})`}>
            <g
              className={reducedMotion ? undefined : 'garden-sprout'}
              style={reducedMotion ? undefined : { animationDelay: `${tree.delay}s` }}
            >
              {/* Ground shadow, so a tree sits *on* the bed rather than over it. */}
              <ellipse cx={0} cy={2} rx={canopy * 0.72} ry={canopy * 0.3} fill={c.groundShadow} />
              <rect
                x={-1.6 * tree.scale}
                y={-trunk}
                width={3.2 * tree.scale}
                height={trunk}
                rx={1.4}
                fill={c.trunkPro}
              />
              {/* One canopy of three blobs — the sprite's silhouette, at sketch size. */}
              <g fill={c.leaf}>
                <circle cx={0} cy={-trunk - canopy * 0.45} r={canopy} />
                <circle cx={-canopy * 0.62} cy={-trunk - canopy * 0.05} r={canopy * 0.66} />
                <circle cx={canopy * 0.62} cy={-trunk - canopy * 0.05} r={canopy * 0.66} />
              </g>
              <circle
                cx={-canopy * 0.3}
                cy={-trunk - canopy * 0.75}
                r={canopy * 0.34}
                fill={c.leafHighlight}
                opacity={0.85}
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
};
