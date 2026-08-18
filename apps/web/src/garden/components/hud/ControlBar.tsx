import React from 'react';
import { Building2, ChevronLeft, ChevronRight, Fish, Play, TreePine, Video } from 'lucide-react';
import { ENABLED_SHAPES, type PlantShape } from '../IsometricGardenCanvas';
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
                  'grid h-9 w-9 place-items-center rounded-full transition-colors cursor-pointer',
                  shape === option.id
                    ? 'bg-garden text-garden-ink'
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

      {/*
        One row: where you are, a step either side, the rail, and the sweep.

        It was three — a heading, a row of neighbouring months, and the slider —
        which stated the current month twice and gave the bar the height of a
        toolbar. The neighbours went first: the rail already shows how much history
        there is, and reading a date off a scrubber is what the label is for.
      */}
      <div className="flex items-center gap-1 pl-0.5">
        <button
          type="button"
          onClick={() => onScrub(Math.max(0, index - 1))}
          disabled={index === 0}
          title="Previous month"
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-inset hover:text-ink disabled:opacity-25 cursor-pointer disabled:cursor-default"
        >
          <ChevronLeft className="h-[16px] w-[16px]" />
        </button>

        <span className="w-[86px] text-center text-[13px] font-bold tabular-nums text-ink">
          {monthLabel}
        </span>

        <button
          type="button"
          onClick={() => onScrub(Math.min(total - 1, index + 1))}
          disabled={index >= total - 1}
          title="Next month"
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-inset hover:text-ink disabled:opacity-25 cursor-pointer disabled:cursor-default"
        >
          <ChevronRight className="h-[16px] w-[16px]" />
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          onChange={(event) => onScrub(Number(event.target.value))}
          aria-label="Month"
          className="mx-2 h-1 w-[180px] cursor-pointer appearance-none rounded-full bg-track accent-garden outline-none"
        />

        <Divider />

        <button
          type="button"
          onClick={onPlay}
          title="Sweep the whole history once"
          className={cx(
            'flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition-colors cursor-pointer',
            isPlaying ? 'bg-garden-wash text-garden-soft' : 'text-ink-soft hover:bg-inset hover:text-ink'
          )}
        >
          {isPlaying ? <Video className="h-[14px] w-[14px]" /> : <Play className="h-[14px] w-[14px]" />}
          {isPlaying ? 'Playing' : 'Auto play'}
        </button>
      </div>
    </Surface>
  </div>
);
