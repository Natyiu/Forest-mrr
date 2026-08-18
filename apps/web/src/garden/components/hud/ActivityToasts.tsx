import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRight, Check, Sparkles, TrendingUp, X } from 'lucide-react';
import { gridToUnscaled } from '../IsometricGardenCanvas';
import { type GardenPlanting } from '../../lib/gardenViews';
import { computeBedPlacement } from '../../lib/plotLayout';

/**
 * Activity, as things that happen.
 *
 * This replaces four hardcoded gardeners who wandered the plot forever holding
 * signs that read "Paid invoice" and "New Sub". They moved constantly and said
 * the same thing whether or not anything had occurred, which is the worst
 * property a moving label can have: it trains you to ignore movement.
 *
 * Now nothing floats unless something actually happened. An event rises out of
 * the plant it happened to, holds long enough to read, and leaves. When the
 * garden is quiet, the garden is still.
 */

export type ActivityKind = 'paid' | 'whale' | 'failed' | 'recovered' | 'upgraded' | 'churned';

export type Activity = {
  id: string;
  kind: ActivityKind;
  label: string;
  /** Anchors the toast to a plant; falls back to the centre of the plot. */
  subscriptionId?: string;
  at: number;
};

const STYLES: Record<
  ActivityKind,
  { icon: React.ComponentType<{ className?: string }>; dot: string; text: string }
> = {
  paid: { icon: Check, dot: 'bg-garden', text: 'text-garden-soft' },
  whale: { icon: Sparkles, dot: 'bg-warn', text: 'text-warn-ink' },
  failed: { icon: X, dot: 'bg-danger', text: 'text-danger-ink' },
  recovered: { icon: TrendingUp, dot: 'bg-garden', text: 'text-garden-soft' },
  upgraded: { icon: ArrowUpRight, dot: 'bg-special', text: 'text-special-ink' },
  churned: { icon: X, dot: 'bg-ink-faint', text: 'text-ink-soft' },
};

export const TOAST_TTL_MS = 3200;

interface ActivityToastsProps {
  activities: Activity[];
  /**
   * The planting as it currently stands. A toast has to point at the tile the
   * plant is *standing on now* — the plot re-beds itself when the metric
   * changes, so a toast laid out against the old one lands on a stranger.
   */
  planting: GardenPlanting;
  transformRef: React.MutableRefObject<{ scale: number; centerX: number; centerY: number } | null>;
  onExpire: (id: string) => void;
}

export const ActivityToasts: React.FC<ActivityToastsProps> = ({
  activities,
  planting,
  transformRef,
  onExpire,
}) => {
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  // Follow the camera without re-rendering React on every canvas frame.
  React.useEffect(() => {
    if (!activities.length) return;
    let raf = 0;
    const tick = () => {
      force();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activities.length]);

  // Expire on a timer rather than on animation end, so a backgrounded tab
  // doesn't accumulate a pile of them.
  React.useEffect(() => {
    if (!activities.length) return;
    const timers = activities.map((activity) =>
      window.setTimeout(() => onExpire(activity.id), Math.max(0, activity.at + TOAST_TTL_MS - Date.now()))
    );
    return () => timers.forEach(window.clearTimeout);
  }, [activities, onExpire]);

  const placements = React.useMemo(
    () => computeBedPlacement(planting.beds).placements,
    [planting.beds]
  );

  const positionOf = (subscriptionId?: string) => {
    const view = transformRef.current;
    if (!view) return null;
    const placement = subscriptionId
      ? placements.find((entry) => entry.plant.subscription_id === subscriptionId)
      : placements[Math.floor(placements.length / 2)];
    if (!placement) return null;
    // Same projection the canvas uses, imported rather than re-derived: two
    // copies of the grid maths is two chances for the toast to drift off its
    // plant the next time a tile size changes.
    const { ux, uy } = gridToUnscaled(placement.gx, placement.gy);
    return {
      x: view.centerX + ux * view.scale,
      y: view.centerY + uy * view.scale,
    };
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {activities.map((activity, index) => {
          const point = positionOf(activity.subscriptionId);
          if (!point) return null;
          const style = STYLES[activity.kind];
          const Icon = style.icon;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: -14, scale: 0.9 }}
              // Clears the canvas's own hover tag, then stacks so a burst of
              // events reads as a list rather than a pile.
              animate={{ opacity: 1, y: -62 - (index % 3) * 30, scale: 1 }}
              exit={{ opacity: 0, y: -92 - (index % 3) * 30, scale: 0.95 }}
              transition={{ y: { duration: 3, ease: 'easeOut' }, default: { duration: 0.22 } }}
              className="absolute -translate-x-1/2"
              style={{ left: point.x, top: point.y }}
            >
              <span className="flex items-center gap-1.5 rounded-full bg-surface py-1.5 pl-1.5 pr-3 shadow-toast ring-1 ring-hairline backdrop-blur-sm">
                <span className={`grid h-5 w-5 place-items-center rounded-full ${style.dot}`}>
                  <Icon className="h-3 w-3 text-garden-ink" />
                </span>
                <span className={`whitespace-nowrap text-[12px] font-semibold ${style.text}`}>
                  {activity.label}
                </span>
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
