import { type CanvasTokens, type ChromeTokens } from '../lib/theme';

/**
 * A metric, drawn as a plant — on the plot itself.
 *
 * The beds only ever visualise MRR, so every *other* metric gets its own
 * specimen. These used to be SVG thumbnails in the revenue panel, at a size
 * where a shoot was three pixels and nobody looked. They are plants in the
 * garden now: authored around the origin, standing on y=0, so a caller only
 * has to translate to a tile and let the plant draw itself upward, exactly
 * like `drawDifferentiatedPlanSprite`.
 *
 * The vocabulary is the garden's own, which is what stops these from being
 * generic infographics:
 *
 *   vigour     how much there is — canopy radius and trunk height
 *   health     whether that is good — accent / warn / danger, in three bands
 *   shoots     new growth this month
 *   fallen     what came off, lying on the bed
 *   stumps     accounts that left
 *   companions the rest of the book, beside the specimen
 *   gaps       loss already bitten out of the canopy
 *
 * Trunk, soil and stump colours come from the *canvas* palette so a specimen is
 * lit by the season the plot is in. The canopy takes chrome status tokens,
 * because canopy colour is the one thing here carrying a judgement, and a
 * judgement must not change hue in October.
 */

export interface PlantSpec {
  /** 0–1. Canopy radius and trunk height. */
  vigour: number;
  /** 0–1. Banded into accent / warn / danger — never a continuous blend. */
  health: number;
  /** New growth above the canopy. */
  shoots?: number;
  /** Leaves on the bed. */
  fallen?: number;
  /** Cut-off accounts beside the specimen. */
  stumps?: number;
  /** Smaller plants sharing the bed. */
  companions?: number;
  /** How small those companions are, 0–1. Low means the specimen dwarfs them. */
  companionScale?: number;
  /** Bite gaps out of the canopy — loss that has already happened. */
  gaps?: number;
  /** Taller, ringed trunk: the same plant further along. */
  mature?: boolean;
  blossom?: boolean;
}

/** Status is banded, not blended: three states an operator can name. */
export function metricCanopyColors(health: number, chrome: ChromeTokens) {
  if (health >= 0.66) return { fill: chrome.accent, highlight: chrome.accentSoft };
  if (health >= 0.33) return { fill: chrome.warn, highlight: chrome.warnInk };
  return { fill: chrome.danger, highlight: chrome.dangerInk };
}

/** Deterministic jitter, so a specimen holds still between frames. */
function wobble(seed: number, spread: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value) - 0.5) * spread;
}

interface Proportions {
  trunkHeight: number;
  trunkTop: number;
  radius: number;
  shoots: number;
}

function proportions(spec: PlantSpec): Proportions {
  const vigour = Math.max(0, Math.min(1, spec.vigour));
  const trunkHeight = 26 + vigour * 30 + (spec.mature ? 16 : 0);
  return {
    trunkHeight,
    trunkTop: -trunkHeight,
    radius: 13 + vigour * 19,
    shoots: Math.round(spec.shoots ?? 0),
  };
}

/** How far above the tile the specimen reaches — where its label has to start. */
export function metricPlantTop(spec: PlantSpec): number {
  const { trunkTop, radius, shoots } = proportions(spec);
  return trunkTop - radius * 0.92 - (shoots > 0 ? 15 : 0);
}

/** Roughly how wide the specimen and its bed are — used for hit-testing. */
export function metricPlantReach(spec: PlantSpec): number {
  const { radius } = proportions(spec);
  return Math.max(30, radius + 16);
}

/** Height of the permanent label, so the hit area can include it. */
export const LABEL_HEIGHT = 34;

export function drawMetricPlantSprite(
  ctx: CanvasRenderingContext2D,
  spec: PlantSpec,
  palette: CanvasTokens,
  chrome: ChromeTokens
) {
  const { trunkTop, radius, shoots } = proportions(spec);
  const canopy = metricCanopyColors(spec.health, chrome);

  const fallen = Math.round(spec.fallen ?? 0);
  const stumps = Math.round(spec.stumps ?? 0);
  const companions = Math.round(spec.companions ?? 0);
  const companionScale = spec.companionScale ?? 0.5;
  const gaps = Math.round(spec.gaps ?? 0);

  // Ground shadow, the same anchor every plant on the plot gets.
  ctx.beginPath();
  ctx.ellipse(0, 3, radius + 6, (radius + 6) * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = palette.groundShadow;
  ctx.fill();

  // Companions: the rest of the book, kept behind the specimen.
  for (let index = 0; index < companions; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const step = Math.floor(index / 2) + 1;
    const cx = side * (14 + step * 11) + wobble(index + 7, 3);
    const scale = companionScale * (0.75 + ((index * 37) % 40) / 100);
    const height = 12 + scale * 16;

    ctx.strokeStyle = palette.trunkStarter;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, -height * 0.55);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = palette.leaf;
    ctx.beginPath();
    ctx.arc(cx, -height * 0.75, 4 + scale * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Stumps: accounts that are gone, and the bed not yet replanted.
  for (let index = 0; index < stumps; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const step = Math.floor(index / 2) + 1;
    const cx = side * (18 + step * 12) + wobble(index + 31, 3);

    ctx.fillStyle = palette.stumpBody;
    ctx.fillRect(cx - 3, -7, 6, 7);
    ctx.fillStyle = palette.stumpTop;
    ctx.beginPath();
    ctx.ellipse(cx, -7, 3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // What has already come off, lying where it fell.
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = canopy.fill;
  for (let index = 0; index < fallen; index++) {
    const cx = wobble(index + 3, 66);
    const cy = 2 + wobble(index + 11, 8);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((wobble(index + 5, 80) * Math.PI) / 180);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Trunk. A mature specimen — ARR is MRR with a year of trunk on it — is
  // taller and ringed, the same way a Scale tree is on the plot.
  ctx.strokeStyle = spec.mature ? palette.trunkEnterprise : palette.trunkPro;
  ctx.lineWidth = spec.mature ? 6 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, trunkTop + radius * 0.5);
  ctx.stroke();

  if (spec.mature) {
    ctx.strokeStyle = palette.trunkScaleRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -16);
    ctx.lineTo(3, -16);
    ctx.moveTo(-3, -27);
    ctx.lineTo(3, -27);
    ctx.stroke();
  }

  // Canopy: three overlapping blobs, the garden's own silhouette.
  ctx.fillStyle = canopy.fill;
  ctx.beginPath();
  ctx.arc(-radius * 0.52, trunkTop + radius * 0.34, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(radius * 0.52, trunkTop + radius * 0.34, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, trunkTop, radius * 0.92, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = canopy.highlight;
  ctx.beginPath();
  ctx.arc(-radius * 0.24, trunkTop - radius * 0.26, radius * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (palette.canopySnow) {
    ctx.fillStyle = palette.canopySnow;
    ctx.beginPath();
    ctx.ellipse(-radius * 0.07, trunkTop - radius * 0.39, radius * 0.66, radius * 0.29, -0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gaps are bitten clean out rather than painted over, so the canopy reads as
  // incomplete instead of as a differently-coloured shape.
  if (gaps > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    for (let index = 0; index < gaps; index++) {
      ctx.beginPath();
      ctx.arc(
        wobble(index + 17, radius * 1.7),
        trunkTop + wobble(index + 23, radius * 1.1),
        radius * 0.24,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  if (spec.blossom) {
    ctx.fillStyle = palette.blossom;
    [
      [-0.5, 0.3],
      [0.45, 0.15],
      [0, -0.55],
    ].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.arc(radius * dx, trunkTop + radius * dy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // New growth: sprigs splayed around the crown on an arc. Evenly spaced
  // uprights would read as an aerial bolted to the tree, not as something the
  // tree did.
  for (let index = 0; index < shoots; index++) {
    const angle = ((-54 + ((index + 0.5) * 108) / shoots) * Math.PI) / 180;
    const crownX = Math.sin(angle) * radius * 0.8;
    const crownY = trunkTop - Math.cos(angle) * radius * 0.66;
    const tipX = Math.sin(angle) * (radius * 0.8 + 14);
    const tipY = trunkTop - Math.cos(angle) * (radius * 0.66 + 14);

    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = chrome.accentInk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = chrome.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.fillStyle = chrome.accent;
    [-42, 42].forEach((tilt) => {
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(angle + (tilt * Math.PI) / 180);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
}

/**
 * The specimen's own label: what it is, and what it currently reads.
 *
 * Every metric plant carries one permanently. A plant whose number you have to
 * open a panel to learn is decoration, and the plot has enough of that.
 */
export function drawMetricLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  topY: number,
  palette: CanvasTokens,
  highlighted: boolean
) {
  ctx.save();

  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  const valueWidth = ctx.measureText(value).width;
  ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
  const labelWidth = ctx.measureText(label.toUpperCase()).width;

  const tagW = Math.max(72, Math.max(valueWidth, labelWidth) + 22);
  const tagH = LABEL_HEIGHT;
  const tagBottom = topY - 10;
  const tagTop = tagBottom - tagH;

  ctx.strokeStyle = palette.stakePost;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, topY);
  ctx.lineTo(0, tagBottom);
  ctx.stroke();

  ctx.fillStyle = palette.stakeTagFill;
  ctx.beginPath();
  ctx.roundRect(-tagW / 2, tagTop, tagW, tagH, 7);
  ctx.fill();
  ctx.strokeStyle = highlighted ? palette.ringHover : palette.stakeTagStroke;
  ctx.lineWidth = highlighted ? 2 : 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.stakeTagText;
  ctx.globalAlpha = 0.75;
  ctx.fillText(label.toUpperCase(), 0, tagTop + 12);

  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.stakeTagText;
  ctx.fillText(value, 0, tagTop + 27);

  ctx.restore();
}

/** Greedy wrap against a measured width. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  return lines;
}

/**
 * How to read the specimen you are pointing at, and what good looks like.
 *
 * The benchmark travels with the plant rather than living only in the panel:
 * an amber canopy is an opinion, and an opinion has to show its working
 * wherever it is shown.
 */
export function drawMetricHoverTag(
  ctx: CanvasRenderingContext2D,
  card: { label: string; value: string; hint: string; reading: string; benchmark: string },
  topY: number,
  palette: CanvasTokens
) {
  const tagW = 232;
  const pad = 12;
  const textW = tagW - pad * 2;

  ctx.save();
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  const readingLines = wrapText(ctx, card.reading, textW);
  const benchmarkLines = wrapText(ctx, card.benchmark, textW);

  const tagH = 42 + readingLines.length * 13 + 8 + benchmarkLines.length * 13 + pad;
  const tagBottom = topY - 52;
  const tagTop = tagBottom - tagH;

  ctx.strokeStyle = palette.tagStem;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, topY - 10);
  ctx.lineTo(0, tagBottom);
  ctx.stroke();

  ctx.fillStyle = palette.tagFill;
  ctx.shadowColor = palette.tagShadow;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(-tagW / 2, tagTop, tagW, tagH, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = palette.tagStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  const left = -tagW / 2 + pad;
  let y = tagTop + pad + 9;

  ctx.textAlign = 'left';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagSub;
  ctx.fillText(card.label.toUpperCase(), left, y);

  y += 19;
  ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagTitle;
  ctx.fillText(card.value, left, y);
  const valueWidth = ctx.measureText(card.value).width;

  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagAccent;
  ctx.fillText(card.hint, left + valueWidth + 7, y);

  y += 15;
  ctx.font = '10px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = palette.tagSub;
  readingLines.forEach((line) => {
    ctx.fillText(line, left, y);
    y += 13;
  });

  y += 6;
  ctx.fillStyle = palette.tagAccent;
  benchmarkLines.forEach((line) => {
    ctx.fillText(line, left, y);
    y += 13;
  });

  ctx.restore();
}
