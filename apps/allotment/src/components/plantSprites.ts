import { HealthState, PlanTier, Plant } from '../types';
import { SIZE_LADDER, planPosition, rampIndex, sampleRamp } from '../lib/plans';
import { CanvasTokens } from '../lib/theme';

/**
 * How a subscription is drawn.
 *
 * Lifted out of the canvas component unchanged: the render loop is about
 * cameras, hit-testing and depth order, and none of that has any business
 * sharing a file with the question of how wide the biggest canopy is.
 *
 * Every sprite is authored around the origin, standing on y=0, so the caller
 * only has to translate to a tile and let the plant draw itself upward.
 *
 * ---
 *
 * The four tiers used to be four independent piles of arcs, and each had grown
 * its own answer to the same three questions. The canopies were three or four
 * *separately filled* circles with loose highlight blobs floating over them, so
 * the silhouette had no edge and the light came from wherever each blob had
 * been placed; the snow cap was drawn unclipped and slid off the side of a
 * canopy it was too wide for; the trunks were round-capped strokes, which put a
 * bulge below the soil line where the cap overshot; and health was carried by
 * scattered dots that read as speckle at plot zoom.
 *
 * They now share one renderer, and it fixes all three at once:
 *
 *  - **One silhouette.** A canopy is one path — every blob in a single
 *    `beginPath` — stroked and *then* filled, so the fill covers the interior
 *    half of the stroke and every seam between blobs. What survives is a clean
 *    hairline around the outside and nothing inside.
 *  - **One light.** Highlight and shade are hard-edged regions clipped to that
 *    silhouette, from the upper left — the direction `sunWash` comes from, the
 *    way a building's lit face points, and the way the snow leans. Three bands
 *    on a canopy, three faces on a tower, one sun.
 *  - **One vocabulary per rung.** Trunk taper, canopy blobs and crown are a row
 *    in `ARCHETYPES`. A rung cannot quietly drift away from its neighbours,
 *    because there is only one place left to draw any of them.
 *
 * The height ladder is load-bearing beyond this file: it is `SIZE_LADDER` in
 * `lib/plans`, and `citySprite` and `fishSprite` sample the same one, so
 * switching modes never reframes the camera.
 */

/** The rim every solid in the garden carries. Shared with `citySprite`. */
const EDGE = 'rgba(0, 0, 0, 0.16)';
/** The turned-away side, on canopies and trunks alike. */
const SHADE = 'rgba(0, 0, 0, 0.12)';
/** The side the sun is on. */
const LIT = 'rgba(255, 255, 255, 0.13)';

interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

/**
 * The canopy: one silhouette, lit once.
 *
 * Stroke-then-fill is the whole trick. Stroking a path of overlapping circles
 * would draw every interior arc as well as the outline; filling the same path
 * afterwards paints over all of them and over the inner half of the outer
 * stroke, leaving exactly the outline and nothing else.
 */
function paintCanopy(
  ctx: CanvasRenderingContext2D,
  blobs: Blob[],
  fill: string,
  highlight: string,
  snow: string | null,
  blossom: string | null
) {
  const trace = () => {
    ctx.beginPath();
    blobs.forEach((blob) => {
      ctx.moveTo(blob.x + blob.rx, blob.y);
      ctx.ellipse(blob.x, blob.y, blob.rx, blob.ry, 0, 0, Math.PI * 2);
    });
  };

  trace();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();

  // Where the light has to fall is a property of the whole canopy, not of
  // whichever blob happens to be on top: a lit crown over unlit shoulders is
  // how the old sprites ended up looking like three separate bushes.
  const minX = Math.min(...blobs.map((b) => b.x - b.rx));
  const maxX = Math.max(...blobs.map((b) => b.x + b.rx));
  const minY = Math.min(...blobs.map((b) => b.y - b.ry));
  const maxY = Math.max(...blobs.map((b) => b.y + b.ry));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const reach = Math.max((maxX - minX) / 2, (maxY - minY) / 2);

  ctx.save();
  trace();
  ctx.clip();

  ctx.fillStyle = highlight;
  ctx.beginPath();
  ctx.arc(cx - reach * 0.44, cy - reach * 0.44, reach * 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SHADE;
  ctx.beginPath();
  ctx.arc(cx + reach * 1.2, cy + reach * 1.05, reach * 1.45, 0, Math.PI * 2);
  ctx.fill();

  // Snow lies on top of the canopy because it is clipped to it. Unclipped, a
  // cap sized off a wide canopy floats clean off a narrow one.
  if (snow) {
    ctx.fillStyle = snow;
    ctx.beginPath();
    ctx.ellipse(cx - reach * 0.08, minY + reach * 0.14, reach * 0.82, reach * 0.24, -0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Blossom: one tight cluster on the lit side, not a handful of speckle
  // scattered over the whole crown. At plot zoom the scatter read as noise on
  // the canvas rather than as anything the plant was doing.
  //
  // Fixed size, deliberately. Scaled with the canopy it becomes three pink
  // golf balls on a whale account — blossom marks that a plant is healthy, and
  // that fact is not twice as true because the subscription is twice as large.
  // Below a certain canopy there is nowhere to put it that is not the whole
  // plant, so it is left off.
  if (blossom && reach >= 11) {
    ctx.fillStyle = blossom;
    [
      [-0.34, -0.3],
      [-0.02, -0.46],
      [-0.44, 0.02],
    ].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(cx + reach * dx, cy + reach * dy, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

/**
 * A trunk that stands on the soil rather than through it.
 *
 * A tapered quad, not a round-capped stroke: the cap on a 4.8px stroke put a
 * two-pixel dome below y=0, which at plot zoom is a tree hovering over its own
 * tile. The lit strip is an explicit polygon rather than a second clip, because
 * a trunk is not worth a clip two hundred times a frame.
 */
function paintTrunk(
  ctx: CanvasRenderingContext2D,
  halfBase: number,
  halfTop: number,
  topY: number,
  color: string
) {
  ctx.beginPath();
  ctx.moveTo(-halfBase, 2);
  ctx.lineTo(-halfTop, topY);
  ctx.lineTo(halfTop, topY);
  ctx.lineTo(halfBase, 2);
  ctx.closePath();

  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = LIT;
  ctx.beginPath();
  ctx.moveTo(-halfBase, 2);
  ctx.lineTo(-halfTop, topY);
  ctx.lineTo(-halfTop * 0.15, topY);
  ctx.lineTo(-halfBase * 0.15, 2);
  ctx.closePath();
  ctx.fill();
}

/**
 * The four tiers, as data.
 *
 * `baseH` is the height ladder `citySprite` mirrors. `blobs` is the canopy in
 * units of the tier's own radius, so a tier's shape and a tier's size stay
 * separate questions — the multiplier scales the radius and the silhouette
 * follows, rather than each blob carrying its own hand-tuned arithmetic.
 *
 * **A silhouette per plan, not one silhouette at several sizes.** A plot
 * filtered to one plan has to look different from a plot filtered to the next
 * even before you read the sizes, because plan is data and size is also data,
 * and if both are carried by area then neither can be read. So the crowns run
 * from a low bush, through a clover crown, to a stacked spire on a ringed
 * trunk, to a broad spreading canopy over a root flare — each recognisable in
 * silhouette at plot zoom, which is where these are actually looked at.
 *
 * **However many plans there are.** The four crowns below are archetypes on a
 * ladder, not a table keyed by name: the numeric half of a plant — how tall,
 * how wide, how heavy the trunk — is *sampled* at the plan's position, so a
 * two-plan product gets the bush and the spreading crown and a five-plan one
 * gets five distinct sizes. Only the crown *layout* is picked discretely,
 * because half a conifer and half a clover is neither; past four plans two
 * neighbours share a layout and are told apart by size and by colour.
 *
 * **And a green per plan.** Silhouette only separates two plants that are side
 * by side and roughly the same age; colour separates them anywhere on the plot,
 * including in the plantings that bed by something other than plan. The ramp is
 * `planFoliage` in `lib/theme` — the season's own leaf, palest at the cheapest
 * plan and deepest at the dearest — so the season still reads and the dunning
 * ladder, which leaves green altogether, still outranks it.
 */
interface TierTree {
  baseH: number;
  /** Canopy radius before the size multiplier. */
  radius: number;
  trunk: { halfBase: number; halfTop: number; topAt: number };
  /** Blob centres as fractions of the radius, heights as fractions of `baseH`. */
  blobs: Array<{ dx: number; atH: number; r: number; squash?: number }>;
  /** Growth rings, at these heights above the soil. */
  rings?: number[];
  /** A splayed root flare — the oldest, heaviest tier only. */
  roots?: boolean;
}

/** Cheapest first. Sampled by position, never indexed by plan name. */
const ARCHETYPES: TierTree[] = [
  // A low bush on a stub of trunk. Nothing to it, which is the point.
  {
    baseH: 18,
    radius: 10,
    trunk: { halfBase: 1.5, halfTop: 1.1, topAt: 0.5 },
    blobs: [{ dx: 0, atH: 0.72, r: 1, squash: 0.78 }],
  },

  // A clover crown: wider than it is tall, clearly off the ground.
  {
    baseH: 28,
    radius: 13,
    trunk: { halfBase: 2, halfTop: 1.3, topAt: 0.62 },
    blobs: [
      { dx: -0.42, atH: 0.76, r: 0.62 },
      { dx: 0.42, atH: 0.76, r: 0.62 },
      { dx: 0, atH: 0.94, r: 0.72 },
    ],
  },

  // A spire: flat discs stacked and narrowing, on the ringed trunk that has
  // always been this rung's tell. Reads as a conifer among broadleaves.
  {
    baseH: 46,
    radius: 17,
    trunk: { halfBase: 2.8, halfTop: 1.6, topAt: 0.52 },
    blobs: [
      { dx: 0, atH: 0.56, r: 0.94, squash: 0.46 },
      { dx: 0, atH: 0.72, r: 0.72, squash: 0.48 },
      { dx: 0, atH: 0.87, r: 0.48, squash: 0.55 },
      { dx: 0, atH: 1.0, r: 0.24, squash: 0.8 },
    ],
    rings: [13, 22],
  },

  // A broad spreading canopy over a heavy trunk and a root flare: the widest
  // thing on the plot, and the only one whose crown reaches past its own tile.
  {
    baseH: 64,
    radius: 24,
    trunk: { halfBase: 4, halfTop: 2.1, topAt: 0.62 },
    blobs: [
      { dx: -0.62, atH: 0.76, r: 0.56 },
      { dx: 0.62, atH: 0.76, r: 0.56 },
      { dx: -0.26, atH: 0.9, r: 0.66 },
      { dx: 0.3, atH: 0.88, r: 0.6 },
      { dx: 0, atH: 0.8, r: 0.86, squash: 0.62 },
    ],
    roots: true,
  },
];

/** Bark, cheapest plan first. Picked at the nearest rung, like the crowns. */
const TRUNK_COLOR: Array<keyof CanvasTokens> = [
  'trunkStarter',
  'trunkPro',
  'trunkScale',
  'trunkEnterprise',
];

/**
 * The tree for a plan.
 *
 * Height and radius are read off the ladder so every plan gets its own, and
 * the trunk is scaled with the height rather than carried in the archetype:
 * a trunk that keeps a neighbour's proportions under a taller crown reads as a
 * drawing error. The crown layout, the growth rings and the root flare come
 * from the nearest archetype, because those are shapes and shapes do not
 * average.
 */
function treeFor(tier: PlanTier): TierTree {
  const position = planPosition(tier);
  const shape = ARCHETYPES[rampIndex(position, ARCHETYPES.length)];
  const baseH = sampleRamp(SIZE_LADDER, position);
  const radius = sampleRamp(ARCHETYPES.map((a) => a.radius), position);
  const scale = baseH / shape.baseH;

  return {
    ...shape,
    baseH,
    radius,
    trunk: {
      halfBase: shape.trunk.halfBase * scale,
      halfTop: shape.trunk.halfTop * scale,
      topAt: shape.trunk.topAt,
    },
    rings: shape.rings?.map((at) => at * scale),
  };
}

const trunkColor = (tier: PlanTier): keyof CanvasTokens =>
  TRUNK_COLOR[rampIndex(planPosition(tier), TRUNK_COLOR.length)];

export function drawDifferentiatedPlanSprite(
  ctx: CanvasRenderingContext2D,
  tier: PlanTier,
  stage: string,
  health: HealthState,
  canopyMult: number,
  palette: CanvasTokens
) {
  if (stage === 'seed') {
    ctx.fillStyle = palette.seedStem;
    ctx.fillRect(-0.9, -7, 1.8, 7);
    ctx.fillStyle = palette.seedHusk;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.5, 2.2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fill();
    return;
  }

  if (stage === 'sprout') {
    ctx.strokeStyle = palette.sproutStem;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -6);
    ctx.stroke();

    paintCanopy(
      ctx,
      [
        { x: -2.4, y: -6, rx: 3.2, ry: 2.1 },
        { x: 2.4, y: -6, rx: 3.2, ry: 2.1 },
      ],
      palette.sproutLeaf,
      palette.sproutLeaf,
      null,
      null
    );
    return;
  }

  if (health === 'stump') {
    paintTrunk(ctx, 3.6, 3, -7, palette.stumpBody);
    ctx.fillStyle = palette.stumpTop;
    ctx.beginPath();
    ctx.ellipse(0, -7, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fill();
    return;
  }

  const spec = treeFor(tier);
  // Healthy foliage is the plan's own green — the season's leaf lifted at the
  // bottom of the ladder, deepened at the top (`planFoliage` in `lib/theme`). Health
  // still replaces it outright rather than tinting it: a plant in trouble is a
  // plant in trouble whatever it pays, and the ladder has to stay the loudest
  // thing on the plot.
  const [leafColor, leafHighlight] =
    health === 'healthy'
      ? (palette.foliage[tier] ?? [palette.leaf, palette.leafHighlight])
      : palette.health[health];

  const radius = spec.radius * canopyMult;

  // Root flare, under the trunk: two struts, drawn before it so the trunk's
  // own rim closes over where they meet it.
  if (spec.roots) {
    ctx.strokeStyle = palette[trunkColor(tier)] as string;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4.5, 2);
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 2);
    ctx.stroke();
  }

  paintTrunk(
    ctx,
    spec.trunk.halfBase,
    spec.trunk.halfTop,
    -spec.baseH * spec.trunk.topAt,
    palette[trunkColor(tier)] as string
  );

  if (spec.rings) {
    ctx.strokeStyle = palette.trunkScaleRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    spec.rings.forEach((at) => {
      ctx.moveTo(-spec.trunk.halfBase * 0.7, -at);
      ctx.lineTo(spec.trunk.halfBase * 0.7, -at);
    });
    ctx.stroke();
  }

  paintCanopy(
    ctx,
    spec.blobs.map((blob) => ({
      x: radius * blob.dx,
      y: -spec.baseH * blob.atH,
      rx: radius * blob.r,
      ry: radius * blob.r * (blob.squash ?? 1),
    })),
    leafColor,
    leafHighlight,
    palette.canopySnow,
    health === 'healthy' || health === 'recovered' ? palette.blossom : null
  );
}

// Specimen Tag Tooltip on Hover
export function drawHoverSpecimenTag(
  ctx: CanvasRenderingContext2D,
  plant: Plant,
  tenureDays: number,
  palette: CanvasTokens
) {
  ctx.save();
  ctx.translate(0, -62);

  const tagW = 160;
  const tagH = 56;

  ctx.strokeStyle = palette.tagStem;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 62);
  ctx.lineTo(0, tagH / 2);
  ctx.stroke();

  ctx.fillStyle = palette.tagFill;
  ctx.shadowColor = palette.tagShadow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.roundRect(-tagW / 2, -tagH / 2, tagW, tagH, 10);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = palette.tagStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagTitle;
  ctx.textAlign = 'center';
  ctx.fillText(plant.customer_name, 0, -tagH / 2 + 16);

  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagSub;
  ctx.fillText(`${plant.plan.toUpperCase()} · COHORT ${plant.cohort}`, 0, -tagH / 2 + 31);

  const years = Math.floor(tenureDays / 365);
  const months = Math.floor((tenureDays % 365) / 30);
  const tenureStr = years > 0 ? `${years}y ${months}m tenure` : `${Math.floor(tenureDays)}d tenure`;

  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagAccent;
  ctx.fillText(`${tenureStr} · $${plant.mrr}/mo`, 0, -tagH / 2 + 45);

  ctx.restore();
}
