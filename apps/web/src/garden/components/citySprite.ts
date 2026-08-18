import { type HealthState, type PlanTier } from '../types';
import { SIZE_LADDER, planPosition, rampIndex, sampleRamp } from '../lib/plans';
import { type CanvasTokens, type ChromeTokens, type ResolvedMode } from '../lib/theme';
import { TILE_H, TILE_W } from '../lib/iso';
import { type PlantSpec, metricCanopyColors } from './metricPlantSprite';

/**
 * The plot as a city.
 *
 * This started as plain extruded blocks, and blocks were already the right
 * *measurement*: the garden answers "what shape is the book of business"
 * beautifully and "which of these two is bigger" badly, because a canopy
 * encodes its value in an area, which is the channel people read worst. A
 * column encodes it in a height against a shared baseline, which is the one
 * they read best.
 *
 * A skyline is that same measurement with something to hold on to. Height still
 * carries the money, exactly as before — but a tower has floors you can count,
 * a roofline, and windows that are either lit or they are not, and none of that
 * costs the ranking anything.
 *
 * Every promise the other modes make is kept:
 *
 *  - **A building is a subscription drawn at the size it actually pays.**
 *    Height is `plan base × canopyMult`, the same multiplier a canopy and a
 *    fish use, against the same `SIZE_LADDER` in `lib/plans` — so switching
 *    modes never reframes the camera or changes which subscription looks like
 *    the big one, and a product with three plans gets three heights off the
 *    same curve rather than a table somebody has to re-tune.
 *  - **Plan is the building type**, not another way of saying size: low-rise,
 *    mid-rise, stepped tower, skyscraper with a spire, up the ladder.
 *    Footprint stays fixed while height varies, leaving height alone to carry
 *    the value.
 *  - **The same reading from colour, in the medium's vocabulary.** A dying
 *    plant turns amber; a dying fish loses its colour; **a failing building
 *    goes dark.** Floors empty from the top down as dunning advances, and the
 *    facade takes the same `health` ladder the trees and the plot have always
 *    used — so the far read is the identical amber, and the near read is the
 *    lights going out. Healthy stock takes city materials from `FACADE`
 *    instead of foliage green, hashed off the subscription so a customer keeps
 *    their building.
 */

/** The rim every solid in the scene carries. Shared with `plantSprites`. */
const EDGE = 'rgba(0, 0, 0, 0.16)';
/**
 * Faces are shaded by laying black or white over the one flat colour rather
 * than by computing three hues. The palette hands us hex in some seasons and
 * `rgba()` in others, and a lighting model that has to parse its inputs is a
 * lighting model that eventually meets a colour it cannot parse.
 *
 * The sun in this scene is up and to the *left* — it is where `sunWash` is
 * anchored, where a canopy's highlight falls and which way its snow leans. So
 * the left face is the lit one. Getting this backwards does not look like a
 * darker building; it looks like one lit from a different scene.
 */
const LIT_FACE = 'rgba(255, 255, 255, 0.10)';
const SHADED_FACE = 'rgba(0, 0, 0, 0.22)';

/**
 * Healthy stock, as city materials — `[facade, roof]`.
 *
 * Assigned by a stable hash of the subscription, so a customer keeps their
 * building across plantings and months. This is decoration and nothing else,
 * which is exactly why it is hashed rather than derived from tier or size:
 * anything that varied with a field would invite a reader to decode it, and
 * there is nothing here to decode. A skyline where every tower is the same
 * colour reads as a bar chart with windows drawn on.
 *
 * All muted, all cool. The amber and red of the dunning ladder have to be the
 * loudest thing on the plot, and they cannot be if a healthy building is
 * allowed to be bright.
 */
const FACADE: Array<[string, string]> = [
  ['#5E7A93', '#7690A6'], // glass
  ['#6E7C86', '#8794A0'], // steel
  ['#7C7A76', '#95928D'], // concrete
  ['#5A6E86', '#74879C'], // slate
  ['#87796E', '#A08F82'], // sandstone
];

/** Windows, lit and unlit. Warm against every facade in `FACADE`. */
const WINDOW_LIT = '#FFD9A0';
const WINDOW_DARK = 'rgba(12, 20, 28, 0.5)';

/**
 * How much of a building is still lit, by health.
 *
 * The lights going out is the city's way of saying what amber leaves say and
 * what a fish's fading colour says. It empties from the top down, because that
 * is how a building empties and because the roofline is the part a reader is
 * already looking at to judge the height.
 */
const OCCUPANCY: Record<HealthState, number> = {
  healthy: 1,
  recovered: 0.9,
  thirsty: 0.8,
  yellowing: 0.6,
  wilting: 0.3,
  browning: 0.08,
  stump: 0,
};

interface TierBuilding {
  /** Footprint as a fraction of a tile. */
  footprint: number;
  /** The `SIZE_LADDER` height `plantSprites` and `fishSprite` also sample. */
  height: number;
  /** Where the tower steps in, as a fraction of its height. */
  setback?: number;
  /** A mast on the roof. The top of the ladder only. */
  spire?: boolean;
}

/** Cheapest first. Sampled by position, never indexed by plan name. */
const ARCHETYPES: TierBuilding[] = [
  { footprint: 0.5, height: 18 },
  { footprint: 0.56, height: 28 },
  { footprint: 0.62, height: 46, setback: 0.72 },
  { footprint: 0.68, height: 64, setback: 0.66, spire: true },
];

/**
 * The building for a plan.
 *
 * Height and footprint are read off the ladder, so every plan gets its own
 * pair whatever the ladder's length; the setback and the spire come from the
 * nearest archetype, because a building either steps in or it does not.
 */
function buildingFor(tier: PlanTier): TierBuilding {
  const position = planPosition(tier);
  const shape = ARCHETYPES[rampIndex(position, ARCHETYPES.length)];
  return {
    ...shape,
    footprint: sampleRamp(ARCHETYPES.map((a) => a.footprint), position),
    height: sampleRamp(SIZE_LADDER, position),
  };
}

/** A floor every this many units, so a taller building genuinely has more. */
const FLOOR_HEIGHT = 7.5;

/**
 * The dunning colours for a state that has them.
 *
 * `HealthState` is wider than the ladder: `healthy` is handled above, `stump`
 * never reaches here, and `thirsty` is a state nothing currently produces. A
 * bare `palette.health[health]` compiled only because the standalone app's
 * config was looser — here it is a lookup that can miss, and a miss is
 * `undefined[0]` inside the render loop.
 */
const dunning = (palette: CanvasTokens, health: HealthState): [string, string] =>
  palette.health[health as keyof CanvasTokens['health']] ?? palette.health.yellowing;

/** Rubble, and the slab a demolished building leaves behind. */
const LOT_HEIGHT = 4;

/** Deterministic, so a window that is dark stays dark between frames. */
function hashed(seed: number, salt: number): number {
  const value = Math.sin(seed * 0.0137 + salt * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function facePath(ctx: CanvasRenderingContext2D, points: Array<[number, number]>) {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Fill a face in the body colour, then lay the shade for its facing over it. */
function drawFace(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  fill: string,
  shade: string | null
) {
  facePath(ctx, points);
  ctx.fillStyle = fill;
  ctx.fill();

  if (shade) {
    ctx.fillStyle = shade;
    ctx.fill();
  }

  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

/**
 * One extruded block.
 *
 * `halfW`/`halfH` are the base diamond's half-extents; `height` is how far it
 * rises above wherever the caller has translated to.
 */
function drawBlock(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  height: number,
  body: string,
  top: string,
  snow: string | null
) {
  const capY = -height;

  // Left face, then right: near-vertical quads from the base diamond's side
  // corners up to the cap. Drawn before the cap so the cap's edge sits over
  // them and the silhouette reads as one solid.
  drawFace(
    ctx,
    [
      [-halfW, capY],
      [0, capY + halfH],
      [0, halfH],
      [-halfW, 0],
    ],
    body,
    LIT_FACE
  );

  drawFace(
    ctx,
    [
      [0, capY + halfH],
      [halfW, capY],
      [halfW, 0],
      [0, halfH],
    ],
    body,
    SHADED_FACE
  );

  const cap: Array<[number, number]> = [
    [0, capY - halfH],
    [halfW, capY],
    [0, capY + halfH],
    [-halfW, capY],
  ];
  drawFace(ctx, cap, top, null);

  // Winter settles on the roof, because the roof is the only face the sky can
  // see. The sides staying clear is what makes it read as lying *on* the
  // building — and it is the one thing about a tower the season still reaches.
  if (snow) {
    ctx.save();
    ctx.globalAlpha = 0.62;
    facePath(ctx, cap);
    ctx.fillStyle = snow;
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Glazing: one band per floor, on both visible faces.
 *
 * Bands rather than a grid of individual panes, and that is a performance
 * decision as much as an aesthetic one — two hundred buildings times two faces
 * times a dozen floors times three panes across is fifteen thousand fills a
 * frame, and this loop runs sixty times a second. A continuous band is one
 * fill, reads as ribbon glazing, and carries the lit/dark state just as well.
 *
 * The faces are parallelograms, so each band is placed in *face* coordinates —
 * `a` across, `b` up — rather than being a rectangle that would sit flat
 * against an isometric wall and look pasted on.
 */
function drawGlazing(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  height: number,
  occupancy: number,
  seed: number
) {
  const floors = Math.max(1, Math.round(height / FLOOR_HEIGHT));
  if (floors < 1 || halfW < 6) return;

  const left = (a: number, b: number): [number, number] => [-halfW + a * halfW, a * halfH - b * height];
  const right = (a: number, b: number): [number, number] => [a * halfW, halfH - a * halfH - b * height];

  for (let floor = 0; floor < floors; floor++) {
    // Empty from the top down: a building loses its top floors first, and the
    // roofline is where a reader is already looking to judge the height.
    const fromTop = (floors - 1 - floor) / floors;
    const lit = fromTop < occupancy && hashed(seed, floor) > 0.16;
    ctx.fillStyle = lit ? WINDOW_LIT : WINDOW_DARK;
    ctx.globalAlpha = lit ? 0.7 : 0.45;

    // Kept narrow. A band that fills its floor turns two hundred buildings
    // into stripes, and the facade — which is what carries health at plot
    // zoom — stops being visible at all.
    const b0 = (floor + 0.36) / floors;
    const b1 = (floor + 0.68) / floors;

    facePath(ctx, [left(0.14, b0), left(0.9, b0), left(0.9, b1), left(0.14, b1)]);
    ctx.fill();

    facePath(ctx, [right(0.1, b0), right(0.86, b0), right(0.86, b1), right(0.1, b1)]);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

/** A parapet and a plant room: the things that stop a roof being a lid. */
function drawRoofline(
  ctx: CanvasRenderingContext2D,
  halfW: number,
  halfH: number,
  at: number,
  facade: string,
  roof: string,
  spire: boolean
) {
  ctx.save();
  ctx.translate(0, -at);

  // Parapet: a slab a touch wider than the shaft, so the roof has an edge.
  drawBlock(ctx, halfW * 1.06, halfH * 1.06, 2.4, roof, roof, null);

  if (halfW > 9) {
    ctx.save();
    ctx.translate(-halfW * 0.16, -2.4);
    drawBlock(ctx, halfW * 0.3, halfH * 0.3, halfW * 0.34, facade, roof, null);
    ctx.restore();
  }

  if (spire) {
    ctx.strokeStyle = roof;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -2.4);
    ctx.lineTo(0, -2.4 - halfW * 0.9);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * A subscription as a building.
 *
 * Takes the same arguments as the tree and the fish, deliberately: the render
 * loop works out *what* a plant is once — species, stage, health, size — and
 * the mode only decides which sprite is handed the answer.
 */
export function drawSubscriptionBuilding(
  ctx: CanvasRenderingContext2D,
  tier: PlanTier,
  stage: string,
  health: HealthState,
  sizeMult: number,
  palette: CanvasTokens,
  seed: number
) {
  const spec = buildingFor(tier);
  const halfW = (spec.footprint * TILE_W) / 2;
  const halfH = (spec.footprint * TILE_H) / 2;

  // Churned: the building is gone. A cleared lot and its rubble, which is where
  // everything else in this app puts what has already left.
  if (health === 'stump') {
    drawBlock(ctx, halfW, halfH, LOT_HEIGHT, palette.stumpBody, palette.stumpTop, null);
    ctx.fillStyle = palette.stumpBody;
    for (let piece = 0; piece < 3; piece++) {
      const side = piece % 2 === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.ellipse(side * halfW * (0.5 + piece * 0.22), -LOT_HEIGHT + 1, 2.6, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Not built yet: a site hoarding and a crane.
  if (stage === 'seed' || stage === 'sprout') {
    const siteH = stage === 'seed' ? 4 : 9;
    drawBlock(ctx, halfW * 0.8, halfH * 0.8, siteH, palette.soilFront, palette.soilSide, null);
    ctx.strokeStyle = palette.stakePost;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(halfW * 0.3, -siteH);
    ctx.lineTo(halfW * 0.3, -siteH - 14);
    ctx.lineTo(-halfW * 0.5, -siteH - 14);
    ctx.stroke();
    return;
  }

  const [facade, roof] =
    health === 'healthy'
      ? FACADE[Math.abs(Math.trunc(seed)) % FACADE.length]
      : dunning(palette, health);

  const height = spec.height * sizeMult;
  const occupancy = OCCUPANCY[health] ?? 1;

  // A stepped tower is two shafts, the upper one set in. Drawn bottom-up so the
  // upper shaft's rim closes over the lower one's cap.
  const lowerHeight = spec.setback ? height * spec.setback : height;

  drawBlock(ctx, halfW, halfH, lowerHeight, facade, roof, spec.setback ? null : palette.canopySnow);
  drawGlazing(ctx, halfW, halfH, lowerHeight, occupancy, seed);

  if (spec.setback) {
    const upperW = halfW * 0.66;
    const upperH = halfH * 0.66;

    ctx.save();
    ctx.translate(0, -lowerHeight);
    drawBlock(ctx, upperW, upperH, height - lowerHeight, facade, roof, palette.canopySnow);
    drawGlazing(ctx, upperW, upperH, height - lowerHeight, occupancy, seed + 17);
    ctx.restore();

    drawRoofline(ctx, upperW, upperH, height, facade, roof, !!spec.spire);
  } else {
    drawRoofline(ctx, halfW, halfH, height, facade, roof, false);
  }
}

/**
 * How far a building reaches, so the ground shadow under it matches its
 * footprint instead of a canopy's. A tower casting a canopy's shadow looks like
 * it is floating over someone else's tile.
 */
export function buildingShadowRadius(tier: PlanTier) {
  return (buildingFor(tier).footprint * TILE_W) / 2;
}

/* ------------------------------------------------------------ the streets */

/**
 * The ground, as a city block.
 *
 * The same lesson the aquarium taught: the beds are most of the pixels, and a
 * lawn is a lawn whatever you stand on it. A skyline growing out of turf is a
 * business park. So the substrate becomes asphalt, the checkerboard becomes the
 * block grid it already looked like, the cut edges become concrete, and a
 * healthy long-tail head becomes a lit window in everything too small to draw a
 * building for. The at-risk share still takes the dunning ladder, so a dark
 * window is a dark window whichever bed it is standing in.
 *
 * Derived rather than added to the theme because none of it is seasonal.
 * Everything that still means something — the dunning ladder, stake and tag
 * chrome, the snow that settles on a roof — passes straight through.
 */
export function toCityGround(palette: CanvasTokens, mode: ResolvedMode): CanvasTokens {
  const ground =
    mode === 'dark'
      ? {
          turfA: '#2C3038',
          turfB: '#282C33',
          turfLine: 'rgba(255, 236, 190, 0.09)',
          soilFront: '#20242A',
          soilSide: '#181B20',
          soilRim: 'rgba(255, 255, 255, 0.09)',
          groundShadow: 'rgba(0, 0, 0, 0.44)',
          litter: ['#3A3F47', '#454A53', '#33373E'],
        }
      : {
          // A/B kept close and the joint line faint. Asphalt is not tiled — the
          // checkerboard is only here to keep the isometric plane legible, and
          // at turf contrast a grey one reads as a car park.
          turfA: '#B9BCC0',
          turfB: '#B2B5BA',
          turfLine: 'rgba(255, 255, 255, 0.4)',
          soilFront: '#8A8D92',
          soilSide: '#75787D',
          soilRim: '#5F6266',
          groundShadow: 'rgba(20, 24, 30, 0.14)',
          litter: ['#A3A6AB', '#9A9DA2', '#ADB0B5'],
        };

  return {
    ...palette,
    turfA: ground.turfA,
    turfB: ground.turfB,
    turfLine: ground.turfLine,
    soilFront: ground.soilFront,
    soilSide: ground.soilSide,
    soilRim: ground.soilRim,
    groundShadow: ground.groundShadow,
    // Road markings and manhole covers, thinner than blossom: scattered as
    // densely as spring litter the street becomes noise the skyline has to be
    // read against, and the skyline is the reading.
    litter: { colors: ground.litter, density: 0.18, size: 1.8 },
  };
}

/* ------------------------------------------------- the border, as monuments */

/**
 * A metric specimen as a tower.
 *
 * The border is part of the plot, so it changes with the plot: leaving eight
 * trees standing in a city says the border is a different kind of object that
 * the mode does not reach, which is exactly the wrong claim — it *is* the menu
 * the plot is planted from.
 *
 * Every word of the specimen vocabulary survives the translation, because none
 * of it was ever about foliage:
 *
 *   vigour     how tall the tower is
 *   health     what colour it is — accent / warn / danger, still banded
 *   shoots     new blocks going up on the roof
 *   fallen     what came off, lying in the street
 *   stumps     cleared lots beside it
 *   companions smaller buildings sharing the block
 *   gaps       storeys bitten clean out of the tower
 *   mature     a heavier tower on a broader podium
 *
 * What still separates a specimen from a subscription is what always did: its
 * own block across a gap of street, its stake, its podium, and a colour that is
 * a *judgement* — chrome tokens, fixed across seasons — rather than the
 * materials the rest of the city is built from.
 */

/** The podium a specimen is presented on. Trunk-coloured, so the season lights it. */
const PODIUM_HEIGHT = 6;

interface TowerProportions {
  halfW: number;
  halfH: number;
  height: number;
  shoots: number;
}

function towerProportions(spec: PlantSpec): TowerProportions {
  const vigour = Math.max(0, Math.min(1, spec.vigour));
  const footprint = spec.mature ? 0.92 : 0.8;
  return {
    halfW: (footprint * TILE_W) / 2,
    halfH: (footprint * TILE_H) / 2,
    // Chosen to land in the same band of heights the tree specimen occupies, so
    // switching modes does not shuffle the labels up and down the avenue.
    height: 34 + vigour * 56 + (spec.mature ? 16 : 0),
    shoots: Math.round(spec.shoots ?? 0),
  };
}

/** How far above the tile the specimen reaches — where its label has to start. */
export function metricTowerTop(spec: PlantSpec): number {
  const { halfH, height, shoots } = towerProportions(spec);
  return -(PODIUM_HEIGHT + height) - halfH - (shoots > 0 ? 11 : 0);
}

/** Roughly how wide the specimen and its block are — used for hit-testing. */
export function metricTowerReach(spec: PlantSpec): number {
  const { halfW } = towerProportions(spec);
  return Math.max(34, halfW + 16);
}

/** Deterministic jitter, so a specimen holds still between frames. */
function wobble(seed: number, spread: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * spread;
}

export function drawMetricTowerSprite(
  ctx: CanvasRenderingContext2D,
  spec: PlantSpec,
  palette: CanvasTokens,
  chrome: ChromeTokens
) {
  const { halfW, halfH, height, shoots } = towerProportions(spec);
  const canopy = metricCanopyColors(spec.health, chrome);

  const fallen = Math.round(spec.fallen ?? 0);
  const stumps = Math.round(spec.stumps ?? 0);
  const companions = Math.round(spec.companions ?? 0);
  const companionScale = spec.companionScale ?? 0.5;
  const gaps = Math.round(spec.gaps ?? 0);

  // Ground shadow, the same anchor every plant on the plot gets.
  ctx.beginPath();
  ctx.ellipse(0, 3, halfW + 8, (halfW + 8) * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = palette.groundShadow;
  ctx.fill();

  // Companions: the rest of the book, kept behind the specimen. Drawn first so
  // the specimen stands in front of them, which is the point of calling them
  // companions rather than neighbours.
  for (let index = 0; index < companions; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const step = Math.floor(index / 2) + 1;
    const cx = side * (halfW + 6 + step * 12) + wobble(index + 7, 3);
    const scale = companionScale * (0.75 + ((index * 37) % 40) / 100);
    const [facade, roof] = FACADE[index % FACADE.length];
    const blockH = 14 + scale * 24;
    const blockW = 9 + scale * 5;

    ctx.save();
    ctx.translate(cx, -2);
    ctx.globalAlpha = 0.9;
    drawBlock(ctx, blockW, blockW / 2, blockH, facade, roof, null);
    drawGlazing(ctx, blockW, blockW / 2, blockH, 1, index * 31);
    ctx.restore();
  }

  // Cleared lots: accounts that left.
  for (let index = 0; index < stumps; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const step = Math.floor(index / 2) + 1;
    const cx = side * (halfW + 10 + step * 13) + wobble(index + 31, 3);

    ctx.save();
    ctx.translate(cx, 1);
    drawBlock(ctx, 7, 3.5, LOT_HEIGHT, palette.stumpBody, palette.stumpTop, null);
    ctx.restore();
  }

  // What has already come off, lying in the street clear of the podium: a
  // tower stands on its footprint, and anything inside that footprint is
  // simply not visible.
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = canopy.fill;
  for (let index = 0; index < fallen; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const cx = side * (halfW + 10 + Math.abs(wobble(index + 3, 2)) * 34);
    const cy = 2 + wobble(index + 11, 11);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2.8);
    ctx.lineTo(cx + 5.4, cy);
    ctx.lineTo(cx, cy + 2.8);
    ctx.lineTo(cx - 5.4, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The podium. Trunk-coloured on purpose: a specimen has to be lit by the
  // season it is standing in, even when its own colour is a fixed judgement.
  drawBlock(
    ctx,
    halfW + 5,
    halfH + 2.5,
    PODIUM_HEIGHT,
    spec.mature ? palette.trunkEnterprise : palette.trunkPro,
    spec.mature ? palette.trunkEnterprise : palette.trunkPro,
    null
  );

  ctx.save();
  ctx.translate(0, -PODIUM_HEIGHT);
  drawBlock(ctx, halfW, halfH, height, canopy.fill, canopy.highlight, palette.canopySnow);
  drawGlazing(ctx, halfW, halfH, height, 1, 7);

  // Gaps are bitten clean out rather than painted over, so the tower reads as a
  // thing with storeys missing instead of as a differently-coloured shape.
  //
  // They are taken from the *edges*, alternating sides, so each one breaks the
  // silhouette. A notch punched in the middle of a face keeps the outline
  // intact and stops reading as damage — it reads as a sign hung on the wall.
  if (gaps > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let index = 0; index < gaps; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const notchW = halfW * 0.85;
      const cx = side * halfW;
      const cy = -height * (0.22 + Math.abs(wobble(index + 23, 1.1)));
      ctx.beginPath();
      ctx.rect(cx - notchW / 2, cy, notchW, 8);
      ctx.fill();
    }
    ctx.restore();
  }

  // New growth, going up on the roof: this month's additions, literally built
  // on top of what was already there.
  for (let index = 0; index < shoots; index++) {
    const spread = shoots === 1 ? 0 : (index / (shoots - 1) - 0.5) * halfW * 1.15;
    ctx.save();
    ctx.translate(spread, -height + (index % 2 === 0 ? 1.5 : -1.5));
    drawBlock(ctx, 6, 3, 11, chrome.accent, chrome.accentSoft, null);
    ctx.restore();
  }

  ctx.restore();
}
