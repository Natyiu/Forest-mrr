import { AmbientLayer } from './theme';

/**
 * Weather that is not weather.
 *
 * Rain in this app means payments, so it cannot also mean "it is raining" —
 * the one particle field already on screen is load-bearing data. Everything
 * here is the other thing: the air of the season. Petals in spring, pollen
 * rising off a hot bed in summer, leaves coming down in autumn, snow in
 * winter, and after dark, fireflies and a sky.
 *
 * It is drawn in screen space, on top of the viewport transform, so zooming
 * into a bed does not zoom into the snow.
 */

export interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  /** Horizontal wander amplitude, px. */
  drift: number;
  /** Per-particle offset so a field does not pulse in unison. */
  phase: number;
  /** Radians/frame for the kinds that tumble. */
  spin: number;
  rotation: number;
  color: string;
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const between = ([low, high]: [number, number]) => low + Math.random() * (high - low);

function seedLayer(layer: AmbientLayer, width: number, height: number): Particle[] {
  return Array.from({ length: layer.count }, () => ({
    x: Math.random() * width,
    // Stars belong to the sky, not the beds, so they stay in the upper band.
    y: layer.kind === 'star' ? Math.random() * height * 0.6 : Math.random() * height,
    size: between(layer.size),
    speed: between(layer.speed),
    drift: layer.drift * (0.5 + Math.random() * 0.5),
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.05,
    rotation: Math.random() * Math.PI * 2,
    color: pick(layer.colors),
  }));
}

/** One particle array per layer, in the same order as `layers`. */
export function seedAmbient(layers: AmbientLayer[], width: number, height: number): Particle[][] {
  return layers.map((layer) => seedLayer(layer, width, height));
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.beginPath();
  // Foreshortened as it tumbles, which is what sells it as a flat thing
  // falling rather than a dot sliding down the screen.
  ctx.ellipse(0, 0, p.size, p.size * Math.abs(Math.cos(p.rotation)) * 0.7 + p.size * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  ctx.restore();
}

function drawLeaf(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.beginPath();
  ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
  // Midrib. At three pixels across it reads as a leaf rather than a lozenge.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-p.size, 0);
  ctx.lineTo(p.size, 0);
  ctx.stroke();
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();
}

function drawFirefly(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
  glow.addColorStop(0, p.color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Advances and draws one set of layers. `pass` splits the sky from the air:
 * stars go down before the garden, everything else on top of it.
 */
export function drawAmbient(
  ctx: CanvasRenderingContext2D,
  layers: AmbientLayer[],
  fields: Particle[][],
  width: number,
  height: number,
  seconds: number,
  pass: 'sky' | 'air'
) {
  ctx.save();
  layers.forEach((layer, index) => {
    const isSky = layer.kind === 'star';
    if ((pass === 'sky') !== isSky) return;

    const particles = fields[index];
    if (!particles) return;

    particles.forEach((p) => {
      switch (layer.kind) {
        case 'star': {
          // Static, but never all at the same brightness at the same time.
          const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(seconds * 1.4 + p.phase));
          drawDot(ctx, p, layer.opacity * twinkle);
          break;
        }

        case 'firefly': {
          // Wanders on two out-of-step sinusoids and blinks off entirely, so
          // the field never looks like a grid of lights bobbing together.
          p.x += Math.sin(seconds * 0.6 + p.phase) * 0.5;
          p.y += Math.cos(seconds * 0.45 + p.phase * 1.7) * 0.35 + p.speed;
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;
          const blink = Math.max(0, Math.sin(seconds * 1.1 + p.phase));
          drawFirefly(ctx, p, layer.opacity * blink);
          break;
        }

        default: {
          p.y += p.speed;
          p.x += Math.sin(seconds * 0.7 + p.phase) * (p.drift / 60);
          p.rotation += p.spin;

          // Wrap in whichever direction the field is travelling.
          if (p.speed >= 0 && p.y > height + 12) {
            p.y = -12;
            p.x = Math.random() * width;
          } else if (p.speed < 0 && p.y < -12) {
            p.y = height + 12;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;

          ctx.globalAlpha = layer.opacity;
          if (layer.kind === 'petal') drawPetal(ctx, p);
          else if (layer.kind === 'leaf') drawLeaf(ctx, p);
          else drawDot(ctx, p, layer.opacity);
          break;
        }
      }
    });
  });
  ctx.restore();
}

/**
 * Deterministic 0–1 noise for a grid cell. Litter placed with this stays put
 * between frames — scatter that resamples every frame is a strobe, not scatter.
 */
export function tileNoise(gx: number, gy: number, salt: number): number {
  let h = Math.imul(gx + 0x9e37, 0x85ebca6b) ^ Math.imul(gy + 0x79b9, 0xc2b2ae35) ^ Math.imul(salt + 1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
