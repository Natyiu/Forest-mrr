import createGlobe, { COBEOptions } from 'cobe';
import { useMotionValue, useSpring } from 'motion/react';
import React, { useCallback, useEffect, useRef } from 'react';

/**
 * The magicui globe (https://magicui.design/docs/components/globe), ported to
 * this app: a COBE-rendered earth that spins on its own and can be dragged.
 *
 * Two things differ from the published source, both because this globe is
 * showing data rather than decorating a landing page:
 *
 * - `phi` and `width` live in refs rather than as plain `let`s in the render
 *   body. Changing the markers changes `config`, which re-creates the globe;
 *   with the spin angle in a ref the new globe carries on from where the old
 *   one was, so filtering to a country does not snap the earth back to zero.
 * - `autoRotate` is a prop, because idle motion is something a reader can
 *   switch off — the modal's orbit button and `prefers-reduced-motion` both
 *   land here. Dragging still works when it is off; only the drift stops.
 * - `onFrame` reports the angle the earth is actually at, every frame. The
 *   full-screen view draws its terminator, its ripples and its country
 *   bubbles on top of this globe, and none of them can be placed without it.
 *   It is a callback rather than state on purpose: this fires at 60fps.
 *
 * The stock `max-w-[600px]` is not in the base classes — each call site sets
 * its own width, because one of them is a panel and the other is the page.
 */

const MOVEMENT_DAMPING = 1400;

/** The stock configuration from the magicui docs, kept as the default. */
const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [1, 1, 1],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
};

interface GlobeProps {
  className?: string;
  config?: COBEOptions;
  /** Whether the earth drifts on its own. Dragging works either way. */
  autoRotate?: boolean;
  /**
   * The angle the earth is at, reported every frame, for anything drawn over
   * the top of it. Called from inside the render loop — do not set state here.
   */
  onFrame?: (phi: number, size: number) => void;
}

export const Globe: React.FC<GlobeProps> = ({
  className,
  config = GLOBE_CONFIG,
  autoRotate = true,
  onFrame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const r = useMotionValue(0);
  const rs = useSpring(r, {
    mass: 1,
    damping: 30,
    stiffness: 100,
    restDelta: 0.001,
  });

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? 'grabbing' : 'grab';
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      r.set(r.get() + delta / MOVEMENT_DAMPING);
    }
  };

  const onRender = useCallback(
    (state: Record<string, unknown>) => {
      if (pointerInteracting.current === null && autoRotateRef.current) {
        phiRef.current += 0.005;
      }
      const phi = phiRef.current + rs.get();
      state.phi = phi;
      state.width = widthRef.current * 2;
      state.height = widthRef.current * 2;
      onFrameRef.current?.(phi, widthRef.current);
    },
    [rs]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => {
      widthRef.current = canvas.offsetWidth;
    };
    window.addEventListener('resize', onResize);
    onResize();

    // The published component listens for window resizes only. That is enough
    // for a globe on a landing page, and not enough here: this one mounts
    // inside a view that is being swapped in, so its first `offsetWidth` can
    // be 0 — and a window that is never resized would leave it there, i.e.
    // blank, forever.
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);

    const globe = createGlobe(canvas, {
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender,
    } as COBEOptions & { onRender: (state: Record<string, unknown>) => void });

    const reveal = setTimeout(() => {
      if (canvasRef.current) canvasRef.current.style.opacity = '1';
    });

    return () => {
      clearTimeout(reveal);
      globe.destroy();
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [config, onRender]);

  return (
    <div
      className={['relative mx-auto aspect-square w-full', className]
        .filter(Boolean)
        .join(' ')}
    >
      <canvas
        ref={canvasRef}
        className="size-full cursor-grab opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX;
          updatePointerInteraction(e.clientX);
        }}
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => {
          if (e.touches[0]) updateMovement(e.touches[0].clientX);
        }}
      />
    </div>
  );
};
