import React from 'react';
import { Building2, Fish, Play, TreePine, Video } from 'lucide-react';
import { ENABLED_SHAPES, PlantShape } from '../IsometricGardenCanvas';
import { Divider, Surface, cx } from './ui';

/**
 * What you are looking at, and when — one bar, bottom centre.
 *
 * The year scrubber lives here rather than in a card of its own at the
 * top-left. The shape switch joins it because it answers the same question one
 * level down — not *when* you are looking, but how the plot draws a
 * subscription.
 */

interface ControlBarProps {
  monthLabel: string;
  index: number;
  total: number;
  onScrub: (index: number) => void;
  onPlay: () => void;
  isPlaying: boolean;
  shape?: PlantShape;
  onShapeChange?: (shape: PlantShape) => void;
}

const ALL_SHAPES: Array<{ id: PlantShape; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'tree', label: 'Trees — the garden (C)', icon: TreePine },
  { id: 'city', label: 'City — towers on one baseline (C)', icon: Building2 },
  { id: 'aquarium', label: 'Aquarium — fish, and payments as a school (C)', icon: Fish },
];

/** A switch with one position is not a switch, so it does not get drawn. */
const SHAPES = ALL_SHAPES.filter((option) => ENABLED_SHAPES.includes(option.id));

export const ControlBar: React.FC<ControlBarProps> = ({
  monthLabel,
  index,
  total,
  onScrub,
  onPlay,
  isPlaying,
  shape,
  onShapeChange,
}) => (
  <div className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
    <Surface className="pointer-events-auto flex items-center gap-1 p-1.5">
      {/* Shape — icon-only, because the icon *is* the answer. */}
      {shape && onShapeChange && SHAPES.length > 1 ? (
        <>
          <div className="flex items-center gap-0.5">
            {SHAPES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onShapeChange(option.id)}
                aria-pressed={shape === option.id}
                title={option.label}
                aria-label={option.label}
                className={cx(
                  'grid h-9 w-9 place-items-center rounded-xl transition-colors cursor-pointer',
                  shape === option.id
                    ? 'bg-accent text-accent-ink'
                    : 'text-ink-soft hover:bg-inset hover:text-ink'
                )}
              >
                <option.icon className="h-[16px] w-[16px]" />
              </button>
            ))}
          </div>
          <Divider />
        </>
      ) : null}

      {/* Time */}
      <div className="flex items-center gap-2.5 pl-1 pr-2">
        <span className="w-[68px] text-[13px] font-bold tabular-nums text-ink">{monthLabel}</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          onChange={(event) => onScrub(Number(event.target.value))}
          aria-label="Month"
          className="h-1.5 w-[160px] cursor-pointer appearance-none rounded-full bg-track accent-accent outline-none"
        />
        <button
          type="button"
          onClick={onPlay}
          title="Play the year"
          aria-label="Play the year"
          className={cx(
            'grid h-9 w-9 place-items-center rounded-xl transition-colors cursor-pointer',
            isPlaying ? 'bg-accent-wash text-accent-soft' : 'text-ink-soft hover:bg-inset'
          )}
        >
          {isPlaying ? <Video className="h-[17px] w-[17px]" /> : <Play className="h-[17px] w-[17px]" />}
        </button>
      </div>
    </Surface>
  </div>
);
