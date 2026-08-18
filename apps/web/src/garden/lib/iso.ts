/**
 * The isometric plane the whole plot is drawn in.
 *
 * These used to live in `IsometricGardenCanvas`, which meant anything that
 * needed to know how big a tile is — a sprite that has to sit inside one, an
 * overlay that has to project a bed onto the screen — had to import the canvas
 * component and take a module cycle with it. The tile is geometry, not a
 * component, so it lives on its own.
 */

/** Full width of a tile's diamond, in unscaled plane units. */
export const TILE_W = 56;
/** Full height of a tile's diamond. Half the width: a 2:1 isometric plane. */
export const TILE_H = 28;

/** Grid coordinates to the unscaled isometric plane — the tile's top corner. */
export function gridToUnscaled(gx: number, gy: number) {
  return { ux: (gx - gy) * (TILE_W / 2), uy: (gx + gy) * (TILE_H / 2) };
}
