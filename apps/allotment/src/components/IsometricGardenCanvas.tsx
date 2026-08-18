import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { GardenState, PlanTier, Plant, WeatherState } from '../types';
import { getCanopyMultiplier, getGrowthStage, getHealthState, getTenureDays } from '../lib/gardenUtils';
import { stringHash } from '../lib/prng';
import { useTheme } from '../lib/ThemeContext';
import { CanvasTokens } from '../lib/theme';
import { usePageVisible, useReducedMotion } from '../lib/useReducedMotion';
import { Particle, drawAmbient, seedAmbient, tileNoise } from '../lib/ambient';
import { MetricCard, MetricId } from '../lib/metricPlants';
import { GardenPlanting, ViewBed } from '../lib/gardenViews';
import { TILE_H, TILE_W, gridToUnscaled } from '../lib/iso';
import { BedMarker, computeBedPlacement } from '../lib/plotLayout';
import { middlePlan, planPosition, sampleRamp } from '../lib/plans';
import { drawDifferentiatedPlanSprite, drawHoverSpecimenTag } from './plantSprites';
import {
  buildingShadowRadius,
  drawMetricTowerSprite,
  drawSubscriptionBuilding,
  metricTowerReach,
  metricTowerTop,
  toCityGround,
} from './citySprite';
import {
  Bubble,
  Fry,
  MAX_FRY,
  WATER,
  drawBubbles,
  drawMetricFishSprite,
  drawOcean,
  drawSchool,
  drawSubscriptionFish,
  drawWater,
  fishSwimHeight,
  metricFishReach,
  metricFishTop,
  seedBubbles,
  seedFry,
  toSeabed,
} from './fishSprite';
import {
  LABEL_HEIGHT,
  PlantSpec,
  drawMetricHoverTag,
  drawMetricLabel,
  drawMetricPlantSprite,
  metricPlantReach,
  metricPlantTop,
} from './metricPlantSprite';

/**
 * The plot.
 *
 * Three things changed here beyond the drawing:
 *
 *  - **The camera lives in a ref, not in state.** Panning used to set React
 *    state on every pointer move, which tore down and rebuilt the whole render
 *    loop between frames. The loop is now started once and reads the camera
 *    each frame, which is also what makes a smooth flight to a plant possible.
 *  - **Hovering is not selecting.** Moving the mouse across the beds used to
 *    open — and then close — the detail drawer for every tree it passed over.
 *    A hover highlights; a click selects.
 *  - **Idle motion is a preference.** Sway, weather and drifting seasonal air
 *    stop for `prefers-reduced-motion`, and the loop stops entirely when the
 *    tab is in the background. Nothing that encodes data ever stops.
 */

interface IsometricGardenCanvasProps {
  gardenState: GardenState;
  weatherState: WeatherState;
  selectedTier: PlanTier | 'All' | null;
  /** A deliberate click on a plant, or on bare soil to clear. */
  onSelectPlant: (plant: Plant | null) => void;
  /** Pointer passing over a plant. Cheap, frequent, and not a selection. */
  onHoverPlant?: (plant: Plant | null) => void;
  selectedPlant: Plant | null;
  /**
   * How the beds are planted right now — which subscriptions are on the plot,
   * and which bed each one stands in. Picking a specimen in the border replants
   * the whole plot; the trees never change meaning, only their beds do.
   */
  planting: GardenPlanting;
  /**
   * The eight metrics as specimens, in their own border. This is the menu: the
   * plot is whichever one of them is selected.
   */
  metricCards?: MetricCard[];
  /** Which specimen the plot is currently planted as. */
  selectedMetric?: MetricId;
  /** Clicking a specimen replants the beds as that metric. */
  onSelectMetric?: (id: MetricId) => void;
  /**
   * How the plot is drawn. `tree` is the garden; `cube` is the same book as
   * columns on a shared baseline, for when the question is "which of these two
   * is bigger" rather than "what shape is this business".
   *
   * It reaches the border as well as the beds. The border is the menu the plot
   * is planted from, so eight trees left standing in a field of cubes would say
   * the mode does not apply to it — and what keeps a specimen distinct from a
   * subscription was never the sprite. It is the separate raised bed, the
   * stake, the plinth, and a colour that is a judgement rather than foliage.
   */
  shape?: PlantShape;
  /**
   * Hold the plot still.
   *
   * The same stillness `prefers-reduced-motion` asks for, asked for by the app
   * rather than by the reader: a playthrough that has finished stops instead of
   * idling on forever. Nothing that encodes data changes — the rain still says
   * what the rain said, the plants keep their health — only the moving stops.
   */
  still?: boolean;
  currentTimeMs: number;
  searchQuery?: string;
  selectedHealth?: string;
  selectedStage?: string;
  /**
   * Ask the camera to walk to a subscription and mark it. The nonce is what
   * makes "find Hyperion" work a second time — the id alone would compare equal
   * and the camera would sit still.
   */
  focusTarget?: FocusTarget | null;
  /** Written every frame so DOM overlays can project grid coords to screen. */
  transformRef?: React.MutableRefObject<{ scale: number; centerX: number; centerY: number } | null>;
}

export interface FocusTarget {
  subscriptionId: string;
  nonce: number;
}

/**
 * The three ways the plot draws a subscription.
 *
 * Each is good at a different question. `tree` says what shape the business is,
 * `city` ranks two neighbours by height on a shared baseline, and `aquarium`
 * says whether the thing is alive — and draws payment volume as a school you
 * can watch grow.
 */
export type PlantShape = 'tree' | 'city' | 'aquarium';

/**
 * The shapes a reader can actually get to.
 *
 * City and aquarium are switched off. They are commented out here rather than
 * deleted, and nothing else was touched: `citySprite.ts` and `fishSprite.ts`
 * are intact, the canvas still knows how to render both, and every derived
 * palette, hit test and specimen path still handles them. This list is the only
 * thing standing between them and the UI — uncomment a line to bring one back.
 *
 * Everything downstream reads it rather than hard-coding the set: the control
 * bar hides its switch when there is only one shape, the `C` binding stops
 * existing (so it cannot appear in the guide or the palette as a key that does
 * nothing), and a link carrying a disabled `?shape=` lands on the garden
 * instead of on a mode that is supposed to be off.
 */
export const ENABLED_SHAPES: PlantShape[] = [
  'tree',
  // 'city',
  // 'aquarium',
];

// Re-exported where they have always been imported from, so the tile can live
// in `lib/iso` without every call site having to know that it moved.
export { TILE_H, TILE_W, gridToUnscaled };

const SOIL_DEPTH = 24;
const TAU = Math.PI * 2;

/**
 * How far a canopy's shadow reaches, up the plan ladder.
 *
 * Sampled rather than listed per plan for the same reason the canopies
 * themselves are: a shadow keyed by plan name is a shadow that silently
 * collapses to its smallest value for any plan the table has not heard of, and
 * a tree floating over its own tile is the tell.
 */
const CANOPY_SHADOW = [8, 10, 12, 15];

/**
 * One tile of turf.
 *
 * Shared by the plot and by the border bed, because the ground is the same
 * ground: two copies of this loop is two chances for the two beds to end up
 * mown differently.
 */
function drawTurfTile(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  palette: CanvasTokens,
  withLitter: boolean
) {
  const p1 = gridToUnscaled(gx, gy);
  const p2 = gridToUnscaled(gx + 1, gy);
  const p3 = gridToUnscaled(gx + 1, gy + 1);
  const p4 = gridToUnscaled(gx, gy + 1);

  ctx.beginPath();
  ctx.moveTo(p1.ux, p1.uy);
  ctx.lineTo(p2.ux, p2.uy);
  ctx.lineTo(p3.ux, p3.uy);
  ctx.lineTo(p4.ux, p4.uy);
  ctx.closePath();

  // The checkerboard is keyed off the tile's own coordinates, so it does not
  // shift when the plot changes shape underneath it.
  ctx.fillStyle = (gx + gy) % 2 === 0 ? palette.turfA : palette.turfB;
  ctx.fill();

  ctx.strokeStyle = palette.turfLine;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Whatever the season has dropped on the bed: blossom, grass tufts, leaf
  // litter, patches of snow. Placement is hashed from the tile coordinates so
  // it holds still while the plants sway.
  const litter = withLitter ? palette.litter : null;
  if (!litter) return;

  for (let mark = 0; mark < 2; mark++) {
    if (tileNoise(gx, gy, mark) > litter.density) continue;
    const along = tileNoise(gx, gy, mark + 10);
    const across = tileNoise(gx, gy, mark + 20);
    const lx = p1.ux + (p2.ux - p1.ux) * along + (p4.ux - p1.ux) * across;
    const ly = p1.uy + (p2.uy - p1.uy) * along + (p4.uy - p1.uy) * across;

    ctx.beginPath();
    ctx.ellipse(lx, ly, litter.size, litter.size * 0.55, 0, 0, TAU);
    ctx.fillStyle = litter.colors[mark % litter.colors.length];
    ctx.fill();
  }
}

/**
 * A bed's signpost.
 *
 * Two lines, always: what the bed is, and what it is worth. A bed called
 * "Churned" with no dollars on it is a category; with them it is a reading.
 */
function drawBedStake(ctx: CanvasRenderingContext2D, marker: BedMarker, palette: CanvasTokens) {
  const stakePos = gridToUnscaled(marker.gx, marker.gy);

  ctx.save();

  ctx.fillStyle = palette.stakePost;
  ctx.fillRect(stakePos.ux - 2, stakePos.uy - 14, 4, 18);

  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  const headline = `${marker.label.toUpperCase()} (${marker.plantCount})`;
  const headlineW = ctx.measureText(headline).width;
  ctx.font = '9px system-ui, -apple-system, sans-serif';
  const noteW = ctx.measureText(marker.note).width;

  const tagW = Math.max(92, Math.max(headlineW, noteW) + 18);
  const tagH = 32;
  ctx.fillStyle = palette.stakeTagFill;
  ctx.beginPath();
  ctx.roundRect(stakePos.ux - tagW / 2, stakePos.uy - 46, tagW, tagH, 6);
  ctx.fill();
  ctx.strokeStyle = palette.stakeTagStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.stakeTagText;
  ctx.fillText(headline, stakePos.ux, stakePos.uy - 32);

  ctx.font = '9px system-ui, -apple-system, sans-serif';
  ctx.globalAlpha = 0.72;
  ctx.fillText(marker.note, stakePos.ux, stakePos.uy - 20);

  ctx.restore();
}

/** The four corners of the rectangular plot, in the unscaled plane. */
type SlabGround = { uTop: Corner; uRight: Corner; uBottom: Corner; uLeft: Corner };
type Corner = { ux: number; uy: number };

/** The plot as rows: a slab of soil with turf mown across the top of it. */
function drawSlabGround(
  ctx: CanvasRenderingContext2D,
  { uTop, uRight, uBottom, uLeft }: SlabGround,
  cols: number,
  rows: number,
  palette: CanvasTokens
) {
  // --- The ground it is standing on ---
  ctx.beginPath();
  ctx.moveTo(uTop.ux, uTop.uy - 10);
  ctx.lineTo(uRight.ux + 20, uRight.uy);
  ctx.lineTo(uBottom.ux, uBottom.uy + 20 + SOIL_DEPTH);
  ctx.lineTo(uLeft.ux - 20, uLeft.uy + SOIL_DEPTH);
  ctx.closePath();
  ctx.fillStyle = palette.groundShadow;
  ctx.fill();

  // --- The two cut faces ---
  ctx.beginPath();
  ctx.moveTo(uBottom.ux, uBottom.uy);
  ctx.lineTo(uRight.ux, uRight.uy);
  ctx.lineTo(uRight.ux, uRight.uy + SOIL_DEPTH);
  ctx.lineTo(uBottom.ux, uBottom.uy + SOIL_DEPTH);
  ctx.closePath();
  ctx.fillStyle = palette.soilFront;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(uLeft.ux, uLeft.uy);
  ctx.lineTo(uBottom.ux, uBottom.uy);
  ctx.lineTo(uBottom.ux, uBottom.uy + SOIL_DEPTH);
  ctx.lineTo(uLeft.ux, uLeft.uy + SOIL_DEPTH);
  ctx.closePath();
  ctx.fillStyle = palette.soilSide;
  ctx.fill();

  ctx.strokeStyle = palette.soilRim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(uLeft.ux, uLeft.uy);
  ctx.lineTo(uBottom.ux, uBottom.uy);
  ctx.lineTo(uRight.ux, uRight.uy);
  ctx.lineTo(uRight.ux, uRight.uy + SOIL_DEPTH);
  ctx.lineTo(uBottom.ux, uBottom.uy + SOIL_DEPTH);
  ctx.lineTo(uLeft.ux, uLeft.uy + SOIL_DEPTH);
  ctx.closePath();
  ctx.stroke();

  // --- Turf ---
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      drawTurfTile(ctx, gx, gy, palette, true);
    }
  }
}

/**
 * The specimen border.
 *
 * The plot itself only ever says one thing — this is the shape of the book of
 * business, measured in MRR. Everything else an operator opens a dashboard for
 * (retention, churn, quick ratio, concentration) used to be a figure on a card
 * behind a modal. It is now an avenue of labelled specimens running alongside
 * the beds: same medium, same season, same glance.
 *
 * It is deliberately a *separate* raised bed rather than trees dropped among
 * the subscriptions, because one of these plants is a ratio and the others are
 * customers, and a reader must never have to wonder which is which.
 */
const BORDER_GAP = 4.5;
const BORDER_WIDTH = 3;
/** Rows between specimens — enough that a label never sits on its neighbour. */
const BORDER_SPACING = 4;
const BORDER_SOIL_DEPTH = 16;

function computeBorder(metricCount: number, anchor: { gxRight: number; gyCenter: number }) {
  if (metricCount <= 0) return null;

  const gxRight = anchor.gxRight;
  const gxLeft = gxRight - BORDER_WIDTH;
  const span = metricCount * BORDER_SPACING;
  // Centred against the plot, so the avenue reads as flanking the beds rather
  // than as having been left over at one end of them.
  const gyStart = Math.round(anchor.gyCenter - span / 2);
  const gxCenter = (gxLeft + gxRight) / 2;

  return {
    gxLeft,
    gxRight,
    gxCenter,
    gyStart,
    gyEnd: gyStart + span,
    specimens: Array.from({ length: metricCount }, (_, index) => ({
      index,
      gx: gxCenter,
      gy: gyStart + BORDER_SPACING / 2 + index * BORDER_SPACING,
    })),
  };
}

type Border = NonNullable<ReturnType<typeof computeBorder>>;

/** The border's soil, turf and signpost — everything under the specimens. */
function drawBorderBed(ctx: CanvasRenderingContext2D, border: Border, palette: CanvasTokens) {
  const top = gridToUnscaled(border.gxLeft, border.gyStart);
  const right = gridToUnscaled(border.gxRight, border.gyStart);
  const bottom = gridToUnscaled(border.gxRight, border.gyEnd);
  const left = gridToUnscaled(border.gxLeft, border.gyEnd);

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(top.ux, top.uy - 8);
  ctx.lineTo(right.ux + 14, right.uy);
  ctx.lineTo(bottom.ux, bottom.uy + 14 + BORDER_SOIL_DEPTH);
  ctx.lineTo(left.ux - 14, left.uy + BORDER_SOIL_DEPTH);
  ctx.closePath();
  ctx.fillStyle = palette.groundShadow;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(bottom.ux, bottom.uy);
  ctx.lineTo(right.ux, right.uy);
  ctx.lineTo(right.ux, right.uy + BORDER_SOIL_DEPTH);
  ctx.lineTo(bottom.ux, bottom.uy + BORDER_SOIL_DEPTH);
  ctx.closePath();
  ctx.fillStyle = palette.soilFront;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(left.ux, left.uy);
  ctx.lineTo(bottom.ux, bottom.uy);
  ctx.lineTo(bottom.ux, bottom.uy + BORDER_SOIL_DEPTH);
  ctx.lineTo(left.ux, left.uy + BORDER_SOIL_DEPTH);
  ctx.closePath();
  ctx.fillStyle = palette.soilSide;
  ctx.fill();

  ctx.strokeStyle = palette.soilRim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left.ux, left.uy);
  ctx.lineTo(bottom.ux, bottom.uy);
  ctx.lineTo(right.ux, right.uy);
  ctx.lineTo(right.ux, right.uy + BORDER_SOIL_DEPTH);
  ctx.lineTo(bottom.ux, bottom.uy + BORDER_SOIL_DEPTH);
  ctx.lineTo(left.ux, left.uy + BORDER_SOIL_DEPTH);
  ctx.closePath();
  ctx.stroke();

  const rows = border.gyEnd - border.gyStart;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < BORDER_WIDTH; column++) {
      drawTurfTile(ctx, border.gxLeft + column, border.gyStart + row, palette, false);
    }
  }

  // The bed's own signpost, at the head of the avenue.
  const stake = gridToUnscaled(border.gxCenter, border.gyStart - 0.4);
  ctx.fillStyle = palette.stakePost;
  ctx.fillRect(stake.ux - 2, stake.uy - 14, 4, 18);

  const tagW = 104;
  ctx.fillStyle = palette.stakeTagFill;
  ctx.beginPath();
  ctx.roundRect(stake.ux - tagW / 2, stake.uy - 34, tagW, 20, 6);
  ctx.fill();
  ctx.strokeStyle = palette.stakeTagStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.stakeTagText;
  ctx.textAlign = 'center';
  ctx.fillText('METRIC BORDER', stake.ux, stake.uy - 21);

  ctx.restore();
}

/**
 * Everything about the plot's geometry that does not change between frames:
 * where each plant stands, how big the bed is, and the scale that fits it to
 * the viewport. Recomputing this per frame — and again on every pointer move,
 * which is what the hit-test used to do — sorted two hundred plants sixty
 * times a second to draw an unchanged grid.
 */
function computeLayout(beds: ViewBed[], width: number, height: number, metricCount: number) {
  const plot = computeBedPlacement(beds);
  const geometry = plot.geometry;

  // The four corners of the slab.
  const ground = {
    uTop: gridToUnscaled(0, 0),
    uRight: gridToUnscaled(geometry.cols, 0),
    uBottom: gridToUnscaled(geometry.cols, geometry.rows),
    uLeft: gridToUnscaled(0, geometry.rows),
  };

  const plotBounds = {
    minX: ground.uLeft.ux,
    maxX: ground.uRight.ux,
    minY: ground.uTop.uy,
    maxY: ground.uBottom.uy,
  };

  const border = computeBorder(metricCount, {
    gxRight: -BORDER_GAP,
    // Clamped so the avenue never starts above the top of the plot.
    gyCenter: Math.max((metricCount * BORDER_SPACING) / 2, geometry.rows / 2),
  });

  // The border tucks into the empty wedge above the plot's left edge, so it
  // costs the fit almost nothing — but its far corner and its labels still
  // have to be inside the frame.
  const borderFar = border ? gridToUnscaled(border.gxLeft, border.gyEnd) : null;
  const borderNear = border ? gridToUnscaled(border.gxLeft, border.gyStart) : null;

  const minUnscaledX = Math.min(plotBounds.minX - 70, borderFar ? borderFar.ux - 60 : Infinity);
  const maxUnscaledX = plotBounds.maxX + 30;
  const minUnscaledY = Math.min(plotBounds.minY - 85, borderNear ? borderNear.uy - 120 : Infinity);
  const maxUnscaledY = plotBounds.maxY + SOIL_DEPTH + 45;

  const baseFitScale = Math.min(
    (width - 60) / (maxUnscaledX - minUnscaledX),
    (height - 80) / (maxUnscaledY - minUnscaledY),
    1.15
  );

  return {
    placements: plot.placements,
    bedMarkers: plot.bedMarkers,
    geometry,
    ground,
    border,
    baseFitScale,
    midX: (minUnscaledX + maxUnscaledX) / 2,
    midY: (minUnscaledY + maxUnscaledY) / 2,
  };
}

type Layout = ReturnType<typeof computeLayout>;

interface Camera {
  zoom: number;
  x: number;
  y: number;
}

interface Flight {
  from: Camera;
  to: Camera;
  startedAt: number;
  duration: number;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.5;

export const IsometricGardenCanvas: React.FC<IsometricGardenCanvasProps> = ({
  gardenState,
  weatherState,
  selectedTier,
  onSelectPlant,
  onHoverPlant,
  selectedPlant,
  planting,
  metricCards,
  selectedMetric,
  onSelectMetric,
  shape = 'tree',
  still = false,
  currentTimeMs,
  searchQuery = '',
  selectedHealth = 'All',
  selectedStage = 'All',
  focusTarget,
  transformRef,
}) => {
  const { theme } = useTheme();
  const chrome = theme.chrome;
  // The water is keyed to light or dark rather than to the season: a tank is a
  // tank in January. Everything *inside* it still takes seasonal tokens.
  const mode = theme.mode;

  /**
   * The ground the plot is laid on.
   *
   * Every mode that is not the garden re-lays it rather than tinting it: water
   * for the aquarium, asphalt for the city. The beds are most of the pixels in
   * the scene, so a lawn under a blue filter is still a lawn and a skyline
   * growing out of turf is a business park. Each derivation overrides only the
   * ground tokens and passes everything that still means something straight
   * through, which is why it can be swapped in at the root and every call site
   * below just gets the right material without knowing which mode it is in.
   */
  const palette = useMemo(() => {
    if (shape === 'aquarium') return toSeabed(theme.canvas, mode);
    if (shape === 'city') return toCityGround(theme.canvas, mode);
    return theme.canvas;
  }, [shape, theme.canvas, mode]);
  // A held playthrough is stillness the app asked for; the media query is
  // stillness the reader asked for. Everything downstream treats them alike.
  const reducedMotion = useReducedMotion() || still;
  const pageVisible = usePageVisible();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<Plant | null>(null);
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 1200, height: 750 });

  // The camera is mutable state that the render loop reads; React only needs
  // to know about it for the zoom readout.
  const cameraRef = useRef<Camera>({ zoom: 1, x: 0, y: 0 });
  const flightRef = useRef<Flight | null>(null);
  const [zoomDisplay, setZoomDisplay] = useState(1);

  // How long the located plant keeps its marker ring after a flight lands.
  const markedUntilRef = useRef(0);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const viewTransformRef = useRef({ scale: 1, centerX: 600, centerY: 375 });

  // A specimen's height and width are the mode's business, and three separate
  // things need them: the hit test, the stake, and the hover tag. Asking the
  // wrong mode is how you get a label floating a foot above its plant.
  const specimenTop = (spec: PlantSpec) =>
    shape === 'city' ? metricTowerTop(spec) : shape === 'aquarium' ? metricFishTop(spec) : metricPlantTop(spec);
  const specimenReach = (spec: PlantSpec) =>
    shape === 'city'
      ? metricTowerReach(spec)
      : shape === 'aquarium'
      ? metricFishReach(spec)
      : metricPlantReach(spec);

  // With motion reduced there is no animation loop to pick a camera change up,
  // so panning and zooming ask for a frame directly.
  const drawRef = useRef<() => void>(() => {});
  const redrawIfStill = () => {
    if (reducedMotion) drawRef.current();
  };

  const rainDropsRef = useRef<Array<{ x: number; y: number; speed: number; length: number }>>([]);
  const ambientRef = useRef<Particle[][]>([]);
  // The tank's own weather. Kept in refs alongside the rain for the same
  // reason: these advance every frame and nothing in React needs to know.
  const fryRef = useRef<Fry[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const lastFrameRef = useRef(0);

  const plot = useMemo(
    () =>
      computeLayout(
        planting.beds,
        canvasDimensions.width,
        canvasDimensions.height,
        metricCards?.length ?? 0
      ),
    [planting.beds, canvasDimensions.width, canvasDimensions.height, metricCards?.length]
  );
  const layoutRef = useRef<Layout>(plot);
  layoutRef.current = plot;

  // Handle Resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasDimensions({
        width: Math.max(800, Math.floor(rect.width)),
        height: Math.max(500, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Initialize rain particles
  useEffect(() => {
    rainDropsRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * 1600,
      y: Math.random() * 1000,
      speed: 12 + Math.random() * 10,
      length: 15 + Math.random() * 15,
    }));
  }, []);

  // Re-seed the seasonal air whenever the season changes or the canvas is
  // resized — particles live in screen space, so a stale field would leave
  // snow piled outside the new viewport.
  useEffect(() => {
    ambientRef.current = seedAmbient(palette.ambient, canvasDimensions.width, canvasDimensions.height);
  }, [palette.ambient, canvasDimensions.width, canvasDimensions.height]);

  // The school and the bubbles live in screen space too, so a resize has to
  // re-stock the tank or half of it ends up swimming off the edge of the glass.
  useEffect(() => {
    fryRef.current = seedFry(canvasDimensions.width, canvasDimensions.height);
    bubblesRef.current = seedBubbles(canvasDimensions.width, canvasDimensions.height);
  }, [canvasDimensions.width, canvasDimensions.height]);

  /** Where the camera has to stand for a grid position to sit mid-screen. */
  const cameraFor = (gx: number, gy: number, zoom: number): Camera => {
    const { ux, uy } = gridToUnscaled(gx, gy);
    const scale = layoutRef.current.baseFitScale * zoom;
    return {
      zoom,
      x: (layoutRef.current.midX - ux) * scale,
      // Nudged down the screen so the specimen tag above the plant stays in view.
      y: (layoutRef.current.midY - uy) * scale + 40,
    };
  };

  // Walk the camera to a plant when something asks for it — a palette result, a
  // row in the revenue panel, a deep link. Jumping there instantly loses the
  // reader: the point of the flight is that you keep your bearings.
  useEffect(() => {
    if (!focusTarget) return;
    const target = plot.placements.find((p) => p.plant.subscription_id === focusTarget.subscriptionId);
    if (!target) return;

    const zoom = Math.max(cameraRef.current.zoom, 1.8);
    const to = cameraFor(target.gx, target.gy, zoom);

    if (reducedMotion) {
      cameraRef.current = to;
      flightRef.current = null;
      drawRef.current();
    } else {
      flightRef.current = { from: { ...cameraRef.current }, to, startedAt: performance.now(), duration: 620 };
    }

    setZoomDisplay(zoom);
    markedUntilRef.current = Date.now() + 6000;
    // `nonce` is deliberately part of the dependency list: it is the whole
    // mechanism by which a repeat request re-runs this.
  }, [focusTarget, plot, reducedMotion]);

  const applyZoom = (next: number, at?: { x: number; y: number }) => {
    const camera = cameraRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const factor = clamped / camera.zoom;

    // Zoom towards the pointer rather than the middle of the plot, so the bed
    // you are looking at is the bed you end up with.
    if (at) {
      camera.x = at.x - (at.x - camera.x) * factor;
      camera.y = at.y - (at.y - camera.y) * factor;
    }
    camera.zoom = clamped;
    flightRef.current = null;
    setZoomDisplay(clamped);
    redrawIfStill();
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    const at = rect
      ? { x: event.clientX - rect.left - canvasDimensions.width / 2, y: event.clientY - rect.top - canvasDimensions.height / 2 }
      : undefined;
    applyZoom(cameraRef.current.zoom * (event.deltaY < 0 ? 1.15 : 0.87), at);
  };

  /** A point in client coordinates, in the isometric plane the plot is drawn in. */
  const toUnscaled = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    const mx = ((clientX - rect.left) / rect.width) * canvas.width;
    const my = ((clientY - rect.top) / rect.height) * canvas.height;

    const { scale, centerX, centerY } = viewTransformRef.current;
    return { ux: (mx - centerX) / scale, uy: (my - centerY) / scale };
  };

  /** The metric specimen under a point, as an index into `metricCards`. */
  const metricAt = (clientX: number, clientY: number): number | null => {
    const border = layoutRef.current.border;
    const cards = metricCards;
    if (!border || !cards?.length) return null;

    const point = toUnscaled(clientX, clientY);
    if (!point) return null;

    let found: number | null = null;
    let minDist = Infinity;

    // A box from the soil to the top of the label, not a circle around the
    // trunk: the number on the stake is the part a reader aims at.
    border.specimens.forEach(({ index, gx, gy }) => {
      const card = cards[index];
      if (!card) return;

      const tile = gridToUnscaled(gx, gy);
      const base = tile.uy + TILE_H / 2;
      const top = base + specimenTop(card.spec) - LABEL_HEIGHT - 12;
      const reach = specimenReach(card.spec);

      const dx = Math.abs(point.ux - tile.ux);
      if (dx > reach || point.uy > base + 8 || point.uy < top) return;

      const dist = Math.hypot(dx, point.uy - (base + top) / 2);
      if (dist < minDist) {
        minDist = dist;
        found = index;
      }
    });

    return found;
  };

  /**
   * The plant under a point in client coordinates, if any.
   *
   * Aimed at the body, not the tile. A tree and a cube stand on their tile so
   * one fixed offset finds both; a fish is up in the water column, and how far
   * up depends on its tier and what it pays. Pointing at gravel and selecting
   * the fish above it is the kind of hit test that feels broken even when it
   * technically works.
   */
  const plantAt = (clientX: number, clientY: number): Plant | null => {
    const point = toUnscaled(clientX, clientY);
    if (!point) return null;
    const { ux, uy } = point;

    let found: Plant | null = null;
    let minDist = 26;

    layoutRef.current.placements.forEach(({ plant, gx, gy, tone }) => {
      const tile = gridToUnscaled(gx, gy);

      let lift = 18;
      if (shape === 'aquarium') {
        // Churned stock is bones on the substrate, not a fish in the water.
        lift =
          tone === 'gone'
            ? 7
            : fishSwimHeight(
                planting.speciesBy === 'uniform' ? middlePlan() : plant.plan,
                planting.sizeBy === 'equal' ? 1 : getCanopyMultiplier(plant.mrr, plant.plan)
              );
      }

      const dist = Math.hypot(ux - tile.ux, uy - (tile.uy + TILE_H / 2 - lift));
      if (dist < minDist) {
        minDist = dist;
        found = plant;
      }
    });

    return found;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    isDraggingRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    panStartRef.current = { x: cameraRef.current.x, y: cameraRef.current.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;

    if (event.buttons === 1) {
      if (Math.hypot(dx, dy) > 4) isDraggingRef.current = true;
      if (isDraggingRef.current) {
        cameraRef.current.x = panStartRef.current.x + dx;
        cameraRef.current.y = panStartRef.current.y + dy;
        flightRef.current = null;
        redrawIfStill();
        return;
      }
    }

    // The border bed is a separate bed and takes the pointer first: its
    // specimens are large, and nothing in the plot stands where they do.
    const metric = metricAt(event.clientX, event.clientY);
    if (metric !== hoveredMetric) setHoveredMetric(metric);

    const found = metric === null ? plantAt(event.clientX, event.clientY) : null;
    if (found?.subscription_id !== hovered?.subscription_id) {
      setHovered(found);
      onHoverPlant?.(found);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // A drag is a camera move, not a choice. Only a clean click selects, and
    // clicking bare soil is how you put the drawer away.
    if (!isDraggingRef.current) {
      const metric = metricAt(event.clientX, event.clientY);
      const card = metric === null ? null : metricCards?.[metric];
      if (card) onSelectMetric?.(card.id);
      else onSelectPlant(plantAt(event.clientX, event.clientY));
    }
    isDraggingRef.current = false;
  };

  const resetView = () => {
    cameraRef.current = { zoom: 1, x: 0, y: 0 };
    flightRef.current = null;
    setZoomDisplay(1);
    redrawIfStill();
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!pageVisible) return;

    let animationFrameId = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Idle motion runs off a clock that stops when motion is unwanted, so
      // every sway, drift and twinkle freezes at the same instant rather than
      // each being special-cased at its call site.
      const seconds = reducedMotion ? 0 : Date.now() / 1000;
      const now = Date.now();

      // Advance any camera flight in progress.
      const flight = flightRef.current;
      if (flight) {
        const t = Math.min(1, (performance.now() - flight.startedAt) / flight.duration);
        const eased = easeInOut(t);
        cameraRef.current = {
          zoom: flight.from.zoom + (flight.to.zoom - flight.from.zoom) * eased,
          x: flight.from.x + (flight.to.x - flight.from.x) * eased,
          y: flight.from.y + (flight.to.y - flight.from.y) * eased,
        };
        if (t >= 1) flightRef.current = null;
      }

      const camera = cameraRef.current;
      const { placements, bedMarkers, border, geometry, ground, baseFitScale, midX, midY } =
        layoutRef.current;

      // The ocean is the *background*, not a filter over the finished scene:
      // opaque, in place of the page, with the plot drawn into it. Seasonal sky
      // has nothing to say underwater.
      if (shape === 'aquarium') drawOcean(ctx, WATER[mode], width, height, seconds);
      else drawAmbient(ctx, palette.ambient, ambientRef.current, width, height, seconds, 'sky');

      const finalScale = baseFitScale * camera.zoom;
      const centerX = width / 2 - midX * finalScale + camera.x;
      const centerY = height / 2 - midY * finalScale + camera.y;

      viewTransformRef.current = { scale: finalScale, centerX, centerY };
      if (transformRef) transformRef.current = { scale: finalScale, centerX, centerY };

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(finalScale, finalScale);

      // --- 1–3. The ground ---
      drawSlabGround(ctx, ground, geometry.cols, geometry.rows, palette);

      // --- 4. Bed Signposts ---
      //
      // They stand at the near edge of their bed with nothing in front of them,
      // so they are painted with the ground rather than over the canopy.
      bedMarkers.forEach((marker) => drawBedStake(ctx, marker, palette));

      // --- 4b. The Specimen Border: every other metric, as a plant ---
      //
      // Its own raised bed, offset from the plot: these specimens are ratios,
      // not customers, and the gap of turf between the two beds is what says
      // so. It sits in the empty wedge above the plot's left edge, so the
      // whole scene still reads at one glance.
      if (border && metricCards && metricCards.length > 0) {
        drawBorderBed(ctx, border, palette);

        border.specimens.forEach(({ index, gx, gy }) => {
          const card = metricCards[index];
          if (!card) return;

          const tile = gridToUnscaled(gx, gy);
          const baseY = tile.uy + TILE_H / 2;
          const isHovered = hoveredMetric === index;
          const isPlanted = selectedMetric === card.id;
          const sway =
            reducedMotion || shape === 'cube' ? 0 : Math.sin(seconds * 1.4 + index * 1.7) * 1.2;

          ctx.save();
          ctx.translate(tile.ux + sway, baseY);
          // The unpicked specimens stay legible but stand back: the plot is
          // showing one of them, and it should be obvious which.
          if (!isPlanted && !isHovered) ctx.globalAlpha = 0.62;

          // The picked one keeps a ring for as long as the plot is planted as
          // it — this is a menu, and a menu has to show its selection.
          if (isPlanted) {
            ctx.beginPath();
            ctx.ellipse(0, 3, 30, 15, 0, 0, Math.PI * 2);
            ctx.strokeStyle = palette.ringMatch;
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = palette.ringMatchFill;
            ctx.fill();
          } else if (isHovered) {
            ctx.beginPath();
            ctx.ellipse(0, 3, 26, 13, 0, 0, Math.PI * 2);
            ctx.strokeStyle = palette.ringHover;
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }

          if (shape === 'city') drawMetricTowerSprite(ctx, card.spec, palette, chrome);
          else if (shape === 'aquarium') drawMetricFishSprite(ctx, card.spec, palette, chrome, seconds, index * 1.7);
          else drawMetricPlantSprite(ctx, card.spec, palette, chrome);

          drawMetricLabel(ctx, card.label, card.value, specimenTop(card.spec), palette, isHovered || isPlanted);

          ctx.restore();
        });

        // Readings last, over their neighbours: a tooltip that a nearer plant
        // draws on top of is not a tooltip.
        if (hoveredMetric !== null && metricCards[hoveredMetric]) {
          const specimen = border.specimens[hoveredMetric];
          const card = metricCards[hoveredMetric];
          const tile = gridToUnscaled(specimen.gx, specimen.gy);

          ctx.save();
          ctx.translate(tile.ux, tile.uy + TILE_H / 2);
          drawMetricHoverTag(ctx, card, specimenTop(card.spec), palette);
          ctx.restore();
        }
      }

      // --- 5. Render Depth-Sorted Plants ---
      const query = searchQuery.trim().toLowerCase();
      const marked = now < markedUntilRef.current ? focusTarget?.subscriptionId : null;

      const renderList = placements
        .map(({ plant, gx, gy, tier, tone }) => ({
          plant,
          gx,
          gy,
          tone,
          ux: gridToUnscaled(gx, gy).ux,
          uy: gridToUnscaled(gx, gy).uy + TILE_H / 2,
          depth: (gy + gx) * 100 + (gx - gy),
          dimmed: !(!selectedTier || selectedTier === 'All' || selectedTier === tier),
        }))
        .sort((a, b) => a.depth - b.depth);

      renderList.forEach((item) => {
        const { plant, ux, uy, gx, gy, dimmed, tone } = item;
        const tenureDays = getTenureDays(plant.started, currentTimeMs);

        // A reading that counts accounts draws one plant per account, whatever
        // it pays: same species, same size, no growth stage. Anything else
        // would answer the revenue question again under another name.
        const uniform = planting.speciesBy === 'uniform';
        const species = uniform ? middlePlan() : plant.plan;
        const stage = uniform ? 'established' : getGrowthStage(tenureDays);
        // Churned subscriptions are not there any more, whatever their last
        // health reading said.
        const health = tone === 'gone' ? 'stump' : getHealthState(plant, currentTimeMs);
        const canopyMult = planting.sizeBy === 'equal' ? 1 : getCanopyMultiplier(plant.mrr, plant.plan);

        const isHovered = hovered?.subscription_id === plant.subscription_id;
        const isSelected = selectedPlant?.subscription_id === plant.subscription_id;
        const isMarked = marked === plant.subscription_id;

        // A building is masonry: it does not sway, and a swaying one reads as
        // a rendering fault rather than as a breeze. A fish does its own moving.
        const sway =
          reducedMotion || shape !== 'tree' ? 0 : Math.sin(seconds * 2 + (gx * 3 + gy * 7)) * 1.5;

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.22 : 1.0;
        ctx.translate(ux + sway, uy);

        // Drop Shadow — sized to whatever is actually standing here, so a
        // tower does not cast a canopy. A fish is not standing on its tile at
        // all, so its shadow is smaller and softer: it is cast from further up.
        const shadowR =
          shape === 'city'
            ? buildingShadowRadius(species)
            : sampleRamp(CANOPY_SHADOW, planPosition(species)) *
              canopyMult *
              (shape === 'aquarium' ? 0.7 : 1);

        ctx.save();
        if (shape === 'aquarium') ctx.globalAlpha *= 0.5;
        ctx.beginPath();
        ctx.ellipse(0, 3, shadowR, shadowR * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = palette.groundShadow;
        ctx.fill();
        ctx.restore();

        // A located plant gets a ring that breathes until you have found it.
        if (isMarked) {
          const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(seconds * 3.4);
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 3, 22 + pulse * 8, 11 + pulse * 4, 0, 0, Math.PI * 2);
          ctx.strokeStyle = palette.ringHover;
          ctx.globalAlpha = (dimmed ? 0.22 : 1) * (0.85 - pulse * 0.45);
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        if (isSelected) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 3, 19, 9.5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = palette.ringMatch;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.restore();
        } else if (isHovered) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 3, 18, 9, 0, 0, Math.PI * 2);
          ctx.strokeStyle = palette.ringHover;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }

        // Search / Filter Highlight Ring
        const matchesSearch =
          query.length > 0 &&
          (plant.customer_name.toLowerCase().includes(query) ||
            plant.subscription_id.toLowerCase().includes(query) ||
            plant.plan.toLowerCase().includes(query) ||
            !!plant.countryName?.toLowerCase().includes(query) ||
            !!plant.countryCode?.toLowerCase().includes(query) ||
            !!plant.region?.toLowerCase().includes(query));

        if (matchesSearch || (selectedHealth !== 'All' && health === selectedHealth) ||
            (selectedStage !== 'All' && stage === selectedStage)) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(0, 3, 20, 10, 0, 0, Math.PI * 2);
          ctx.strokeStyle = palette.ringMatch;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.fillStyle = palette.ringMatchFill;
          ctx.fill();
          ctx.restore();
        }

        // Health droop. Trees only: a leaning cube loses the shared baseline
        // that is the entire reason to be looking at cubes, and health is
        // already carried by the colour in both modes.
        if (shape === 'tree') {
          if (health === 'yellowing') ctx.rotate((5 * Math.PI) / 180);
          else if (health === 'wilting') ctx.rotate((10 * Math.PI) / 180);
          else if (health === 'browning') ctx.rotate((15 * Math.PI) / 180);
        }

        // Whale Sunbeam
        if (weatherState.sunbeamPlantId === plant.subscription_id) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, -22, 32, 0, Math.PI * 2);
          ctx.fillStyle = palette.sunbeamFill;
          ctx.fill();
          ctx.strokeStyle = palette.sunbeamRing;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        if (shape === 'city') {
          drawSubscriptionBuilding(
            ctx,
            species,
            stage,
            health,
            canopyMult,
            palette,
            stringHash(plant.subscription_id)
          );
        } else if (shape === 'aquarium') {
          // Seeded off the subscription rather than the tile, so a customer
          // keeps the same fish — same colour, same habits — when a different
          // metric re-beds the plot and moves them somewhere else.
          drawSubscriptionFish(
            ctx,
            species,
            stage,
            health,
            canopyMult,
            palette,
            seconds,
            stringHash(plant.subscription_id)
          );
        } else {
          drawDifferentiatedPlanSprite(ctx, species, stage, health, canopyMult, palette);
        }

        if (isHovered || isSelected || isMarked) {
          // The tag hangs off whatever it is labelling. A fish is up in the
          // water column, so a tag pinned to the tile would point at gravel.
          ctx.save();
          if (shape === 'aquarium' && health !== 'stump') {
            ctx.translate(0, -fishSwimHeight(species, canopyMult) + 20);
          }
          drawHoverSpecimenTag(ctx, plant, tenureDays, palette);
          ctx.restore();
        }

        ctx.restore();
      });

      ctx.restore(); // Restore Viewport Transform

      // --- 7a. The tank ---
      //
      // In aquarium mode the water stands in for the weather, and the school
      // stands in for the rain: **one fry per unit of payment volume**, so the
      // number that makes it rain on the garden is the number that fills the
      // tank. Pay the business and there are visibly more fish.
      //
      // Like the rain, the count is data and holds when motion is reduced —
      // only the swimming stops.
      if (shape === 'aquarium') {
        const water = WATER[mode];
        const advance = reducedMotion ? 0 : Math.min(0.05, (now - lastFrameRef.current) / 1000);
        lastFrameRef.current = now;

        drawWater(ctx, water, width, height, seconds);
        drawBubbles(ctx, bubblesRef.current, water.bubble, width, height, advance, seconds);
        drawSchool(
          ctx,
          fryRef.current,
          Math.min(MAX_FRY, weatherState.rainIntensity),
          water,
          width,
          height,
          advance,
          seconds
        );
      }

      // --- 7b. Rain Weather Effect ---
      // Rain means payments, so it is data: it keeps falling when idle motion
      // is switched off, just without the per-frame advance. It does not fall
      // indoors — in a tank the school is carrying the same reading.
      if (weatherState.rainIntensity > 0 && shape !== 'aquarium') {
        ctx.save();
        ctx.strokeStyle = palette.rain;
        ctx.lineWidth = 1.2;
        rainDropsRef.current.forEach((drop) => {
          if (!reducedMotion) {
            drop.y += drop.speed;
            drop.x -= drop.speed * 0.3;
            if (drop.y > height) {
              drop.y = -20;
              drop.x = Math.random() * width;
            }
          }
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - drop.length * 0.3, drop.y + drop.length);
          ctx.stroke();
        });
        ctx.restore();
      }

      // --- 8. Seasonal air, in front of the plot ---
      // Petals and snow are *air*, and there is none in the tank.
      if (!reducedMotion && shape !== 'aquarium') {
        drawAmbient(ctx, palette.ambient, ambientRef.current, width, height, seconds, 'air');
      }

      // --- 9. The light itself ---
      if (palette.sunWash) {
        const wash = ctx.createRadialGradient(
          width * 0.18, height * 0.05, 0,
          width * 0.18, height * 0.05, Math.max(width, height) * 0.9
        );
        wash.addColorStop(0, palette.sunWash);
        wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, width, height);
      }

      if (palette.vignette) {
        const edge = ctx.createRadialGradient(
          width / 2, height / 2, Math.min(width, height) * 0.32,
          width / 2, height / 2, Math.max(width, height) * 0.78
        );
        edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
        edge.addColorStop(1, palette.vignette);
        ctx.fillStyle = edge;
        ctx.fillRect(0, 0, width, height);
      }
    };

    drawRef.current = render;

    const loop = () => {
      render();
      animationFrameId = requestAnimationFrame(loop);
    };

    // With motion reduced there is nothing to animate between inputs, so the
    // plot is drawn once per change rather than sixty times a second — unless
    // a camera flight or a marker pulse is genuinely in flight.
    if (reducedMotion) render();
    else loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [
    gardenState,
    weatherState,
    selectedTier,
    hovered,
    hoveredMetric,
    metricCards,
    selectedMetric,
    shape,
    planting,
    selectedPlant,
    currentTimeMs,
    canvasDimensions,
    searchQuery,
    selectedHealth,
    selectedStage,
    focusTarget,
    palette,
    chrome,
    mode,
    reducedMotion,
    // A hidden tab tears the loop down and a restored one starts it again.
    pageVisible,
    transformRef,
  ]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative w-full h-full flex items-center justify-center overflow-hidden select-none"
    >
      <canvas
        ref={canvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          setHovered(null);
          setHoveredMetric(null);
          onHoverPlant?.(null);
        }}
        className="cursor-grab active:cursor-grabbing w-full h-full object-contain bg-transparent"
      />

      {/* Floating Canvas Zoom & Pan Control Dock */}
      <div className="absolute bottom-20 left-6 z-30 flex items-center gap-1 rounded-full border border-hairline bg-surface p-1.5 text-ink-soft shadow-panel backdrop-blur-md">
        <button
          type="button"
          onClick={() => applyZoom(cameraRef.current.zoom * 1.25)}
          className="rounded-full p-2 transition-colors hover:bg-accent-wash hover:text-accent-soft cursor-pointer"
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="min-w-[36px] px-1 text-center text-[11px] font-semibold tabular-nums text-ink-soft">
          {Math.round(zoomDisplay * 100)}%
        </span>
        <button
          type="button"
          onClick={() => applyZoom(cameraRef.current.zoom * 0.8)}
          className="rounded-full p-2 transition-colors hover:bg-accent-wash hover:text-accent-soft cursor-pointer"
          title="Zoom out (−)"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-hairline" />
        <button
          type="button"
          onClick={resetView}
          className="rounded-full p-2 transition-colors hover:bg-accent-wash hover:text-accent-soft cursor-pointer"
          title="Fit the whole plot (0)"
          aria-label="Fit the whole plot"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
