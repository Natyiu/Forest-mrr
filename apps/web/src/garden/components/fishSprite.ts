import { type HealthState, type PlanTier } from '../types';
import { SIZE_LADDER, planPosition, rampIndex, sampleRamp } from '../lib/plans';
import { type CanvasTokens, type ChromeTokens, type ResolvedMode } from '../lib/theme';
import { type PlantSpec, metricCanopyColors } from './metricPlantSprite';

/**
 * The plot as an aquarium.
 *
 * A third way of drawing the same book, and it earns its place the way cube
 * mode did — by being good at something the others are not. Trees say what
 * shape the business is. Cubes rank two neighbours by height. A tank says
 * whether the business is *alive*: a room full of fish is a thing you read the
 * mood of in a second, long before you read any number on it.
 *
 * Everything the other two modes promise is kept:
 *
 *  - **A fish is a subscription, drawn at the size it actually pays.** Body
 *    length runs off the same `getCanopyMultiplier` a canopy and a column do.
 *  - **A silhouette per plan.** A guppy, a deep-bodied angel, a striped
 *    torpedo, a heavy koi, up the ladder — sampled at the plan's position, so
 *    the vocabulary stretches to however many plans there are. Plan
 *    is readable in outline, so it is not competing with size for the one
 *    channel size already uses.
 *  - **The same reading from colour**, in the medium's own vocabulary. This is
 *    the one place the aquarium departs from the other two modes, and it is a
 *    deliberate departure: a green fish is a leaf with fins, and amber cannot
 *    mean "in trouble" in a tank where a perfectly healthy fish is allowed to
 *    be orange. So healthy stock takes real fish colouring and a failing
 *    subscription *loses* its colour instead of changing hue — see `STOCK` and
 *    `AILING`. The question a reader answers at a glance is identical to the
 *    garden's; only the words are the water's.
 *  - **The same swim height ladder as the height ladder.** 18 / 28 / 46 / 64,
 *    so switching modes never reframes the camera.
 *
 * What it adds is the school: **payments are fry.** The garden draws payment
 * volume as rain; a tank cannot, so the same number draws as small fish in the
 * water column. Money arriving means more fish, which is the whole reason
 * anybody looks at an aquarium.
 *
 * The fish carry their own light: highlight along the back, shade under the
 * belly. That is both what light does underwater and the only lighting scheme
 * that survives a fish turning round — the trees' upper-left sun would flip to
 * the wrong side the moment one swam the other way.
 */

const EDGE = 'rgba(0, 0, 0, 0.16)';
/** The back, where the light from the surface lands. */
const BACK_LIT = 'rgba(255, 255, 255, 0.16)';
/** The belly, turned away from it. */
const BELLY_SHADE = 'rgba(0, 0, 0, 0.15)';
const STRIPE = 'rgba(0, 0, 0, 0.11)';

/**
 * The tank itself.
 *
 * The one place aquarium colours live, the way seasonal air lives in
 * `lib/ambient`. Water is keyed to light or dark rather than to the season: a
 * tank is a tank in January. The season still reaches everything inside it —
 * the substrate, the beds and the fish all take canvas tokens.
 */
export const WATER: Record<ResolvedMode, {
  /** Just under the surface, where the light comes in. */
  surface: string;
  /** The open water the plot stands in. */
  mid: string;
  /** Below the plot, where the light has run out. */
  deep: string;
  /** The underside of the surface itself. */
  surfaceGlow: string;
  /** Shafts of sunlight coming down through it. */
  ray: string;
  /** Light broken by the surface, falling across the scene. */
  caustic: string;
  bubble: string;
  /** Suspended matter between the eye and the plot. */
  haze: string;
  fry: string;
  fryBack: string;
}> = {
  light: {
    surface: '#ADE7F2',
    mid: '#46A6D4',
    deep: '#0F5E92',
    surfaceGlow: 'rgba(255, 255, 255, 0.5)',
    ray: '#E4F8FF',
    caustic: 'rgba(255, 255, 255, 0.2)',
    bubble: 'rgba(255, 255, 255, 0.55)',
    haze: 'rgba(24, 118, 170, 0.1)',
    fry: '#EAF7FF',
    fryBack: '#B9E6FA',
  },
  dark: {
    surface: '#1E7396',
    mid: '#0F4A6C',
    deep: '#062A43',
    surfaceGlow: 'rgba(178, 235, 255, 0.3)',
    ray: '#9BDCF7',
    caustic: 'rgba(190, 232, 255, 0.14)',
    bubble: 'rgba(203, 234, 255, 0.36)',
    haze: 'rgba(4, 32, 52, 0.16)',
    fry: '#CFEEFF',
    fryBack: '#7FC9E8',
  },
};

/**
 * The seabed.
 *
 * A tank drawn over lawns is a lawn with a blue filter on it. The beds are the
 * one thing in the scene that carries the metaphor at full strength — they are
 * most of the pixels — so aquarium mode does not tint them, it re-lays them:
 * water where the turf was, a deeper blue at the cut edges so the slab reads as
 * a body of it rather than as a painted lid, silt for litter, and coral for a
 * healthy head in the long-tail bed.
 *
 * It is a *derived* palette rather than an eight-variant addition to the
 * theme, because none of it is seasonal. Everything that still means something
 * — foliage colour for healthy stock, the dunning ladder, the stake and tag
 * chrome — is passed straight through, so a bed stake and a hover tag look the
 * same underwater as they do above it. The stock does not take its colour from
 * here at all; see `STOCK` and `AILING`.
 */
export function toSeabed(palette: CanvasTokens, mode: ResolvedMode): CanvasTokens {
  const bed =
    mode === 'dark'
      ? {
          // Kept just above the water column's own value. Darker than the
          // water and the bed stops reading as a lit shelf and starts reading
          // as a hole cut in the ocean.
          turfA: '#175071',
          turfB: '#154868',
          turfLine: 'rgba(170, 224, 255, 0.06)',
          soilFront: '#0C3450',
          soilSide: '#082638',
          soilRim: 'rgba(170, 224, 255, 0.10)',
          groundShadow: 'rgba(1, 10, 20, 0.44)',
          litter: ['#1B587C', '#22638A', '#154A6B'],
        }
      : {
          // A/B kept close and the grid line faint. Water is not tiled — the
          // checkerboard is only here to keep the isometric plane legible, and
          // at the garden's contrast it turns the bed into a swimming pool.
          turfA: '#63B5E0',
          turfB: '#58ACDA',
          turfLine: 'rgba(255, 255, 255, 0.20)',
          soilFront: '#2A6892',
          soilSide: '#20547A',
          soilRim: '#194466',
          groundShadow: 'rgba(8, 40, 70, 0.16)',
          litter: ['#4494C4', '#3A8ABC', '#52A2CE'],
        };

  return {
    ...palette,
    turfA: bed.turfA,
    turfB: bed.turfB,
    turfLine: bed.turfLine,
    soilFront: bed.soilFront,
    soilSide: bed.soilSide,
    soilRim: bed.soilRim,
    groundShadow: bed.groundShadow,
    // Silt, thinner on the ground than blossom is: scattered as densely as
    // spring litter it turns the bed into noise the fish have to be read
    // against, and the fish are the reading.
    litter: { colors: bed.litter, density: 0.2, size: 1.9 },
    // Nothing settles on anything down here, and there is no sun to wash the
    // plot with — the water's own gradient is doing that job.
    canopySnow: null,
    sunWash: null,
  };
}

/* ------------------------------------------------------ how a fish is coloured */

/**
 * Real fish colouring, as `[body, back]`.
 *
 * Assigned by a stable hash of the subscription, so a customer keeps their fish
 * across plantings and months. This is **decoration and nothing else** — which
 * is exactly why it is hashed rather than derived from tier or size. Anything
 * that varied with a field would invite a reader to decode it, and there is
 * nothing here to decode. A tank where every fish is the same colour reads as a
 * diagram of fish.
 *
 * Blue is deliberately absent: the bed and the water are blue, and a blue fish
 * on blue water is a fish nobody can count.
 */
const STOCK: Array<[string, string]> = [
  ['#F5822B', '#FBB56A'], // clownfish orange
  ['#EFB025', '#FBD976'], // yellow tang
  ['#D94F9C', '#F191C7'], // rose
  ['#17A97A', '#63D6AE'], // parrotfish
  ['#E1543F', '#F3907E'], // vermillion
];

/**
 * Dunning, as a fish shows it.
 *
 * The garden turns a plant amber because that is what a dying plant does. A
 * dying fish does something else: it **loses its colour**, going pale, then
 * grey, then ghostly. So the ailing ladder here is not another hue among the
 * stock's hues — it is the *absence* of one, which is both what the animal
 * actually does and a stronger signal than amber could be in a tank where a
 * healthy fish is allowed to be orange.
 *
 * The reading is identical to the garden's and to the cubes': at a glance, how
 * much of the book is in trouble. Only the vocabulary is the medium's own.
 * Recovery returns the colour, because that is the whole point of recovering.
 */
const AILING: Record<'yellowing' | 'wilting' | 'browning' | 'recovered', [string, string]> = {
  yellowing: ['#C2B69F', '#DED5C4'],
  wilting: ['#B0A9A2', '#CFCAC5'],
  browning: ['#9B9B9E', '#C0C0C3'],
  recovered: ['#2FB88C', '#7FDCBA'],
};

function stockColors(health: HealthState, seed: number): [string, string] {
  if (health === 'healthy') return STOCK[Math.abs(Math.trunc(seed)) % STOCK.length];
  return AILING[health as keyof typeof AILING] ?? STOCK[0];
}

interface FishSpec {
  /** Nose to tail root. */
  length: number;
  /** Body depth as a fraction of length. */
  depth: number;
  /** How far the tail reaches past the root. */
  tail: number;
  /** Dorsal fin height above the back. */
  dorsal: number;
  /** Vertical bars down the flank. */
  stripes: number;
  /** How high above its tile this tier swims. */
  swim: number;
}

/**
 * The archetypes, cheapest first. `swim` is `SIZE_LADDER` — the same ladder the
 * canopies and the towers sample — so a plot of fish occupies the same band of
 * screen a plot of trees does.
 */
const ARCHETYPES: FishSpec[] = [
  { length: 18, depth: 0.5, tail: 6, dorsal: 2.6, stripes: 0, swim: 18 },
  { length: 25, depth: 0.66, tail: 8, dorsal: 4.5, stripes: 0, swim: 28 },
  { length: 34, depth: 0.46, tail: 11, dorsal: 4, stripes: 3, swim: 46 },
  { length: 46, depth: 0.62, tail: 15, dorsal: 5, stripes: 0, swim: 64 },
];

/** The smallest fish in the book. Fry, companions and specimen shoals are these. */
const SMALLEST = ARCHETYPES[0];

const sampleAcross = (pick: (spec: FishSpec) => number, position: number) =>
  sampleRamp(ARCHETYPES.map(pick), position);

/**
 * The fish for a plan.
 *
 * Every measurement is read off the ladder so each plan gets its own body;
 * only the flank stripes are picked discretely, because a fish has a whole
 * number of them or none.
 */
function fishFor(tier: PlanTier): FishSpec {
  const position = planPosition(tier);
  const shape = ARCHETYPES[rampIndex(position, ARCHETYPES.length)];
  return {
    length: sampleAcross((s) => s.length, position),
    depth: sampleAcross((s) => s.depth, position),
    tail: sampleAcross((s) => s.tail, position),
    dorsal: sampleAcross((s) => s.dorsal, position),
    stripes: shape.stripes,
    swim: sampleRamp(SIZE_LADDER, position),
  };
}

/**
 * One fish, nose to the right, centred on its own body.
 *
 * Built as a single path — body, tail and fins as subpaths of one `beginPath` —
 * then stroked and filled, the same trick the canopies use: the fill covers
 * every interior stroke and the inner half of the outline, leaving one clean
 * silhouette and no seam where the tail meets the body.
 */
function paintFish(
  ctx: CanvasRenderingContext2D,
  spec: FishSpec,
  scale: number,
  body: string,
  highlight: string,
  /** Radians of tail beat. Zero holds still. */
  beat: number,
  bite?: (ctx: CanvasRenderingContext2D, halfLen: number, halfDepth: number) => void
) {
  const halfLen = (spec.length * scale) / 2;
  const halfDepth = (spec.length * scale * spec.depth) / 2;
  const tail = spec.tail * scale;
  const dorsal = spec.dorsal * scale;

  const trace = () => {
    ctx.beginPath();

    // Body: a lens, pointed at the nose and drawn back to the tail root.
    ctx.moveTo(halfLen, 0);
    ctx.bezierCurveTo(halfLen * 0.5, -halfDepth, -halfLen * 0.5, -halfDepth, -halfLen, 0);
    ctx.bezierCurveTo(-halfLen * 0.5, halfDepth, halfLen * 0.5, halfDepth, halfLen, 0);

    // Tail, forked, swung by the beat.
    const swing = Math.sin(beat) * tail * 0.32;
    ctx.moveTo(-halfLen * 0.9, 0);
    ctx.lineTo(-halfLen - tail + swing * 0.3, -tail * 0.78 + swing);
    ctx.lineTo(-halfLen - tail * 0.5, swing * 0.4);
    ctx.lineTo(-halfLen - tail + swing * 0.3, tail * 0.78 + swing);
    ctx.closePath();

    // Dorsal fin.
    ctx.moveTo(halfLen * 0.2, -halfDepth * 0.75);
    ctx.lineTo(-halfLen * 0.12, -halfDepth - dorsal);
    ctx.lineTo(-halfLen * 0.5, -halfDepth * 0.7);
    ctx.closePath();

    // Pelvic fin.
    ctx.moveTo(halfLen * 0.18, halfDepth * 0.72);
    ctx.lineTo(-halfLen * 0.04, halfDepth + dorsal * 0.45);
    ctx.lineTo(-halfLen * 0.26, halfDepth * 0.66);
    ctx.closePath();
  };

  trace();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  trace();
  ctx.clip();

  // Three bands down the flank, the way the canopies have three and the cubes
  // three faces. Kept narrow at the ends: the fish's *own* colour has to hold
  // the middle of the body, or health stops being legible at plot zoom and
  // every fish in the tank reads the same pale green.
  const span = halfLen + tail + 2;

  ctx.fillStyle = highlight;
  ctx.fillRect(-span, -halfDepth - dorsal - 2, span * 2, halfDepth * 0.52 + dorsal + 2);

  ctx.fillStyle = BACK_LIT;
  ctx.fillRect(-span, -halfDepth - dorsal - 2, span * 2, halfDepth * 0.3 + dorsal + 2);

  ctx.fillStyle = BELLY_SHADE;
  ctx.fillRect(-span, halfDepth * 0.34, span * 2, halfDepth + dorsal);

  ctx.fillStyle = STRIPE;
  for (let index = 0; index < spec.stripes; index++) {
    const x = halfLen * (0.34 - index * 0.36);
    ctx.fillRect(x - halfLen * 0.07, -halfDepth * 1.6, halfLen * 0.14, halfDepth * 3.2);
  }

  // Loss, bitten clean out of the fish. Only the metric specimens use it.
  if (bite) {
    ctx.globalCompositeOperation = 'destination-out';
    bite(ctx, halfLen, halfDepth);
  }

  ctx.restore();

  // The eye goes on last and outside the clip: it is the one mark that makes
  // the silhouette read as an animal rather than as a leaf on its side.
  //
  // Clamped at both ends. Scaled freely it becomes a cartoon on a whale
  // account and disappears on a Starter, and an eye is not a measurement — it
  // is the thing that says "fish", and that is equally true at every size.
  const eye = Math.max(1.5, Math.min(3.2, halfDepth * 0.19));
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(halfLen * 0.56, -halfDepth * 0.24, eye, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.beginPath();
  ctx.arc(halfLen * 0.58 + eye * 0.25, -halfDepth * 0.24, eye * 0.52, 0, Math.PI * 2);
  ctx.fill();
}

/** Deterministic jitter, so a fish keeps its habits between frames. */
function wobble(seed: number, spread: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * spread;
}

/** How high above its tile a subscription swims — where its hover tag hangs. */
export function fishSwimHeight(tier: PlanTier, sizeMult: number) {
  const spec = fishFor(tier);
  return spec.swim + ((spec.length * sizeMult * spec.depth) / 2) * 0.5;
}

/**
 * A subscription as a fish.
 *
 * Same arguments as the tree and the cube, deliberately: the render loop works
 * out *what* a plant is once — species, stage, health, size — and the mode only
 * decides which sprite is handed the answer.
 *
 * `seconds` and `seed` drive the swim. A fish that holds perfectly still is a
 * dead fish, so this is the one sprite where idle motion is doing a job — but
 * it is still idle motion, and `prefers-reduced-motion` stops it dead. Nothing
 * that encodes data moves either way.
 */
export function drawSubscriptionFish(
  ctx: CanvasRenderingContext2D,
  tier: PlanTier,
  stage: string,
  health: HealthState,
  sizeMult: number,
  palette: CanvasTokens,
  seconds: number,
  seed: number
) {
  const spec = fishFor(tier);
  const drift = seconds === 0 ? 0 : Math.sin(seconds * 0.9 + seed) * 3;
  const beat = seconds === 0 ? 0 : seconds * 4.5 + seed;

  // Churned: the fish is not there any more. Bones on the substrate, where
  // everything else in this app puts what has already left.
  if (health === 'stump') {
    ctx.save();
    ctx.translate(0, -7);
    ctx.strokeStyle = palette.stumpBody;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(6, 0);
    for (let rib = 0; rib < 4; rib++) {
      const x = -6 + rib * 3.4;
      ctx.moveTo(x, -3.2);
      ctx.lineTo(x, 3.2);
    }
    ctx.moveTo(-9, 0);
    ctx.lineTo(-13, -3.4);
    ctx.moveTo(-9, 0);
    ctx.lineTo(-13, 3.4);
    ctx.stroke();

    ctx.fillStyle = palette.stumpTop;
    ctx.beginPath();
    ctx.arc(7.5, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // A seed has not hatched; a sprout is fry. Neither is worth a silhouette.
  if (stage === 'seed') {
    ctx.fillStyle = palette.seedHusk;
    for (let egg = 0; egg < 3; egg++) {
      ctx.beginPath();
      ctx.arc(-3 + egg * 3, -3 - (egg % 2) * 2, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const [body, highlight] = stockColors(health, seed);

  if (stage === 'sprout') {
    ctx.save();
    ctx.translate(0, -10 + drift * 0.5);
    paintFish(ctx, { ...SMALLEST, swim: 0 }, 0.5, body, highlight, beat);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.translate(0, -spec.swim + drift);
  // Half the stock faces the other way, because a tank where every fish points
  // the same direction reads as wallpaper. The back-lit / belly-shaded lighting
  // is mirror-safe, which is why it is lit that way in the first place.
  if (wobble(seed + 5, 2) > 0) ctx.scale(-1, 1);
  paintFish(ctx, spec, sizeMult, body, highlight, beat);
  ctx.restore();
}

/* ------------------------------------------------- the border, as specimens */

const SPECIMEN: FishSpec = { length: 46, depth: 0.6, tail: 15, dorsal: 8, stripes: 0, swim: 0 };
/** How high a specimen hangs above its bed, before its own body depth. */
const SPECIMEN_SWIM = 42;

function specimenScale(spec: PlantSpec) {
  const vigour = Math.max(0, Math.min(1, spec.vigour));
  return 0.62 + vigour * 0.62 + (spec.mature ? 0.2 : 0);
}

/** How far above the tile the specimen reaches — where its label has to start. */
export function metricFishTop(spec: PlantSpec): number {
  const scale = specimenScale(spec);
  const halfDepth = (SPECIMEN.length * scale * SPECIMEN.depth) / 2;
  const shoots = Math.round(spec.shoots ?? 0);
  return -SPECIMEN_SWIM - halfDepth - SPECIMEN.dorsal * scale - (shoots > 0 ? 16 : 0);
}

/** Roughly how wide the specimen and its bed are — used for hit-testing. */
export function metricFishReach(spec: PlantSpec): number {
  const scale = specimenScale(spec);
  return Math.max(36, (SPECIMEN.length * scale) / 2 + SPECIMEN.tail * scale + 8);
}

/**
 * A metric as a specimen fish, hanging over the border bed.
 *
 * The vocabulary comes across whole, because none of it was ever about
 * foliage — or about masonry:
 *
 *   vigour     how big the fish is
 *   health     what colour it is, still banded accent / warn / danger
 *   shoots     fry rising above it — this month's new growth
 *   fallen     what came off, lying on the substrate
 *   stumps     bones on the floor beside it
 *   companions smaller fish sharing the tank
 *   gaps       bitten clean out of the body
 *   mature     a heavier fish, and a stand under it
 *
 * What still separates a specimen from a subscription is what always did: its
 * own bed across a gap of substrate, its stake, its stand, and a colour that is
 * a *judgement* — chrome tokens, which do not move with the season — rather
 * than the stock's own seasonal colouring.
 */
export function drawMetricFishSprite(
  ctx: CanvasRenderingContext2D,
  spec: PlantSpec,
  palette: CanvasTokens,
  chrome: ChromeTokens,
  seconds: number,
  seed: number
) {
  const scale = specimenScale(spec);
  const canopy = metricCanopyColors(spec.health, chrome);
  const halfLen = (SPECIMEN.length * scale) / 2;
  const halfDepth = (SPECIMEN.length * scale * SPECIMEN.depth) / 2;

  const fallen = Math.round(spec.fallen ?? 0);
  const stumps = Math.round(spec.stumps ?? 0);
  const companions = Math.round(spec.companions ?? 0);
  const companionScale = spec.companionScale ?? 0.5;
  const gaps = Math.round(spec.gaps ?? 0);
  const shoots = Math.round(spec.shoots ?? 0);

  const drift = seconds === 0 ? 0 : Math.sin(seconds * 0.8 + seed) * 3.5;
  const beat = seconds === 0 ? 0 : seconds * 4 + seed;

  // The stand: a plinth on the substrate, so a specimen is presented rather
  // than merely present. Trunk-coloured, so the season lights it.
  ctx.fillStyle = spec.mature ? palette.trunkEnterprise : palette.trunkPro;
  ctx.beginPath();
  ctx.ellipse(0, 0, halfLen * 0.5, halfLen * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Companions: the rest of the book, kept behind the specimen.
  for (let index = 0; index < companions; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const step = Math.floor(index / 2) + 1;
    const size = companionScale * (0.75 + ((index * 37) % 40) / 100);

    const [body, back] = STOCK[index % STOCK.length];

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.translate(
      side * (halfLen + 8 + step * 13) + wobble(index + 7, 4),
      -SPECIMEN_SWIM + wobble(index + 13, 22) + drift * 0.6
    );
    if (side < 0) ctx.scale(-1, 1);
    paintFish(ctx, SMALLEST, size * 1.1, body, back, beat + index);
    ctx.restore();
  }

  // Bones on the floor: accounts that left.
  for (let index = 0; index < stumps; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const step = Math.floor(index / 2) + 1;
    const cx = side * (halfLen * 0.6 + 10 + step * 12) + wobble(index + 31, 3);

    ctx.strokeStyle = palette.stumpBody;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, -2);
    ctx.lineTo(cx + 4, -2);
    ctx.moveTo(cx - 3, -4.4);
    ctx.lineTo(cx - 3, 0.4);
    ctx.moveTo(cx, -4.4);
    ctx.lineTo(cx, 0.4);
    ctx.moveTo(cx - 6, -2);
    ctx.lineTo(cx - 9, -4.4);
    ctx.moveTo(cx - 6, -2);
    ctx.lineTo(cx - 9, 0.4);
    ctx.stroke();
  }

  // What has already come off, settled on the substrate clear of the stand.
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = canopy.fill;
  for (let index = 0; index < fallen; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const cx = side * (halfLen * 0.6 + 8 + Math.abs(wobble(index + 3, 2)) * 32);
    const cy = 1 + wobble(index + 11, 8);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(0, -SPECIMEN_SWIM + drift);

  paintFish(
    ctx,
    SPECIMEN,
    scale,
    canopy.fill,
    canopy.highlight,
    beat,
    gaps > 0
      ? (bitten, bLen, bDepth) => {
          // Taken from the edges, alternating, so each one breaks the outline.
          // A hole in the middle of a flank keeps the silhouette intact and
          // stops reading as damage.
          for (let index = 0; index < gaps; index++) {
            const side = index % 2 === 0 ? -1 : 1;
            bitten.beginPath();
            bitten.arc(
              wobble(index + 17, bLen * 1.1),
              side * bDepth,
              bDepth * 0.42,
              0,
              Math.PI * 2
            );
            bitten.fill();
          }
        }
      : undefined
  );

  // New growth, rising off the specimen's back.
  for (let index = 0; index < shoots; index++) {
    const spread = shoots === 1 ? 0 : (index / (shoots - 1) - 0.5) * halfLen * 1.1;
    ctx.save();
    ctx.translate(spread, -halfDepth - 12 - (index % 2) * 4);
    paintFish(ctx, SMALLEST, 0.42, chrome.accent, chrome.accentSoft, beat + index * 1.3);
    ctx.restore();
  }

  ctx.restore();
}

/* ------------------------------------------------------------- the water */

export interface Fry {
  x: number;
  y: number;
  speed: number;
  scale: number;
  facing: 1 | -1;
  phase: number;
  /** 0 near, 1 far: far fry are smaller, paler and slower. */
  depth: number;
}

export interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

/** How many fry the tank can hold. Beyond this the school stops being countable. */
export const MAX_FRY = 44;

export function seedFry(width: number, height: number): Fry[] {
  return Array.from({ length: MAX_FRY }, (_, index) => ({
    x: wobble(index + 1, 2) * width * 0.5 + width * 0.5,
    y: height * (0.12 + Math.abs(wobble(index + 41, 2)) * 0.78),
    speed: 14 + Math.abs(wobble(index + 61, 2)) * 34,
    scale: 0.3 + Math.abs(wobble(index + 71, 2)) * 0.3,
    facing: wobble(index + 81, 2) > 0 ? 1 : -1,
    phase: Math.abs(wobble(index + 91, 2)) * 6.28,
    depth: Math.abs(wobble(index + 101, 2)),
  }));
}

export function seedBubbles(width: number, height: number): Bubble[] {
  return Array.from({ length: 54 }, (_, index) => ({
    x: Math.abs(wobble(index + 3, 2)) * width,
    y: Math.abs(wobble(index + 23, 2)) * height,
    r: 1.2 + Math.abs(wobble(index + 33, 2)) * 2.6,
    speed: 16 + Math.abs(wobble(index + 43, 2)) * 30,
    phase: Math.abs(wobble(index + 53, 2)) * 6.28,
  }));
}

/**
 * The ocean the plot is standing in — drawn **before** everything, in place of
 * the page.
 *
 * The first attempt at this was a translucent blue veil laid over the finished
 * scene, and it did not read as water at all. It read as dusk: the garden's own
 * pale page still showed through it, and the only thing the veil actually did
 * was take light *out*. Water is not a filter you put over a room. It is the
 * room.
 *
 * So this replaces the background outright, opaque, and puts back the three
 * things that say "underwater and sunlit" rather than "dark":
 *
 *  - a bright surface overhead, with the light coming in through it
 *  - shafts of that light coming down and drifting
 *  - the column getting deeper and bluer *below* you, not around the edges
 *
 * The corner vignette that used to be here is gone. Darkening the corners is
 * how you say night; deepening downwards is how you say depth.
 */
export function drawOcean(
  ctx: CanvasRenderingContext2D,
  water: (typeof WATER)[ResolvedMode],
  width: number,
  height: number,
  seconds: number
) {
  const column = ctx.createLinearGradient(0, 0, 0, height);
  column.addColorStop(0, water.surface);
  column.addColorStop(0.42, water.mid);
  column.addColorStop(1, water.deep);
  ctx.fillStyle = column;
  ctx.fillRect(0, 0, width, height);

  // Sunlight, coming down in shafts and leaning as the surface moves. Wide,
  // faint and slow: this is the single strongest cue that there is water
  // between the viewer and the light, and the only one that survives being
  // covered by the plot.
  ctx.save();
  for (let ray = 0; ray < 9; ray++) {
    const x = (ray / 8) * width * 1.25 - width * 0.12 + Math.sin(seconds * 0.18 + ray * 1.3) * 34;
    const top = 30 + Math.sin(seconds * 0.24 + ray * 2.1) * 16;
    const lean = height * 0.38;

    ctx.globalAlpha = 0.055 + 0.04 * Math.sin(seconds * 0.3 + ray * 1.9);
    ctx.fillStyle = water.ray;
    ctx.beginPath();
    ctx.moveTo(x, -20);
    ctx.lineTo(x + top, -20);
    ctx.lineTo(x - lean + top * 2.4, height);
    ctx.lineTo(x - lean, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // The surface, seen from underneath: a bright band with a moving edge, and
  // ripples running along it.
  const wave = (x: number) =>
    30 + Math.sin(x * 0.021 + seconds * 0.8) * 7 + Math.sin(x * 0.047 - seconds * 1.25) * 4;

  ctx.save();
  ctx.fillStyle = water.surfaceGlow;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(width, -10);
  for (let x = width; x >= 0; x -= 12) ctx.lineTo(x, wave(x));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = water.surfaceGlow;
  ctx.lineWidth = 1.6;
  for (let ripple = 1; ripple <= 3; ripple++) {
    ctx.globalAlpha = 0.5 / ripple;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const y = wave(x) + ripple * 13 + Math.sin(x * 0.03 + seconds * (0.7 + ripple * 0.2)) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The water *in front of* the plot: haze, broken light and bubbles.
 *
 * Drawn in screen space after the plot, where the rain used to be. Between this
 * and `drawOcean` the plot is sandwiched inside the water rather than sitting
 * behind a sheet of it, which is the difference between a scene that is
 * underwater and one that has merely been tinted.
 */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  water: (typeof WATER)[ResolvedMode],
  width: number,
  height: number,
  seconds: number
) {
  // Suspended matter, thickening with depth. Distance between the eye and the
  // thing being looked at is what makes water read as a volume.
  const haze = ctx.createLinearGradient(0, 0, 0, height);
  haze.addColorStop(0, 'rgba(0, 0, 0, 0)');
  haze.addColorStop(1, water.haze);
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  // Caustics: light broken by the surface, falling across whatever is under it.
  ctx.save();
  ctx.strokeStyle = water.caustic;
  ctx.lineCap = 'round';
  for (let band = 0; band < 7; band++) {
    const drift = Math.sin(seconds * 0.35 + band * 1.4) * 40;
    const x = ((band + 0.5) / 7) * width + drift;
    ctx.lineWidth = 16 + Math.sin(seconds * 0.5 + band) * 7;
    ctx.globalAlpha = 0.5 + Math.sin(seconds * 0.6 + band * 2.1) * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, -20);
    ctx.lineTo(x - 70, height * 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

/** Bubbles rise whether or not anything is happening: the tank is aerated. */
export function drawBubbles(
  ctx: CanvasRenderingContext2D,
  bubbles: Bubble[],
  color: string,
  width: number,
  height: number,
  advance: number,
  seconds: number
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  bubbles.forEach((bubble, index) => {
    if (advance > 0) {
      bubble.y -= bubble.speed * advance;
      if (bubble.y < -10) {
        bubble.y = height + 10;
        bubble.x = Math.abs(wobble(index + seconds, 2)) * width;
      }
    }
    const x = bubble.x + Math.sin(seconds * 1.6 + bubble.phase) * 5;
    ctx.beginPath();
    ctx.arc(x, bubble.y, bubble.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * The school: **one fry per unit of payment volume.**
 *
 * This is the aquarium's answer to the rain. The garden draws payments falling
 * on the beds; a tank draws them swimming in it. The count is the reading — pay
 * the business and there are visibly more fish — so it keeps moving when idle
 * motion is off, exactly as the rain does. Only the swimming stops.
 */
export function drawSchool(
  ctx: CanvasRenderingContext2D,
  fry: Fry[],
  count: number,
  water: (typeof WATER)[ResolvedMode],
  width: number,
  height: number,
  advance: number,
  seconds: number
) {
  const shown = Math.max(0, Math.min(fry.length, Math.round(count)));

  ctx.save();
  for (let index = 0; index < shown; index++) {
    const one = fry[index];
    if (advance > 0) {
      one.x += one.speed * one.facing * (1 - one.depth * 0.5) * advance;
      if (one.x > width + 40) one.x = -40;
      if (one.x < -40) one.x = width + 40;
    }

    const y = one.y + Math.sin(seconds * 1.1 + one.phase) * 6;

    ctx.save();
    ctx.translate(one.x, y);
    ctx.scale(one.facing, 1);
    ctx.globalAlpha = 0.9 - one.depth * 0.35;
    paintFish(
      ctx,
      SMALLEST,
      one.scale * (1 - one.depth * 0.3),
      one.depth > 0.55 ? water.fryBack : water.fry,
      water.fryBack,
      seconds === 0 ? 0 : seconds * 6 + one.phase
    );
    ctx.restore();
  }
  ctx.restore();
}
