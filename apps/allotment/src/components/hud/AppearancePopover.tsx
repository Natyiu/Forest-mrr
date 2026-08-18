import React from 'react';
import { Monitor, Moon, Sun, Wand2 } from 'lucide-react';
import { SEASONS, SEASON_LABELS, Season, ThemeMode, seasonSwatch } from '../../lib/theme';
import { useTheme } from '../../lib/ThemeContext';
import { Popover, SectionLabel, cx } from './ui';

/**
 * Appearance: light or dark, and which season the plot is dressed for.
 *
 * Both settings can defer rather than decide — `System` follows the OS,
 * `Follow timeline` follows the month under the scrubber — and both defaults
 * are the deferring one, because the interesting version of this feature is
 * the garden changing on its own as you scrub through a year. Pinning a season
 * is for when you want to look at one deliberately.
 *
 * Every option previews itself in its own palette rather than describing it,
 * since "Autumn" is a much weaker signal than a strip of ochre turf under a
 * rust canopy.
 */

const MODE_OPTIONS: Array<{ id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

/** Turf and canopy for one season, at swatch size. */
const SeasonSwatch: React.FC<{ season: Season; mode: 'light' | 'dark' }> = ({ season, mode }) => {
  const [turf, leaf] = seasonSwatch(season, mode);
  return (
    <span
      className="grid h-7 w-full place-items-center rounded-lg ring-1 ring-inset ring-black/10"
      style={{ background: turf }}
    >
      <span className="h-3.5 w-3.5 rounded-full" style={{ background: leaf }} />
    </span>
  );
};

/** All four at once, for the option that refuses to pick one. */
const AutoSwatch: React.FC<{ mode: 'light' | 'dark' }> = ({ mode }) => (
  <span className="flex h-7 w-full overflow-hidden rounded-lg ring-1 ring-inset ring-black/10">
    {SEASONS.map((season) => {
      const [turf, leaf] = seasonSwatch(season, mode);
      return (
        <span key={season} className="grid flex-1 place-items-center" style={{ background: turf }}>
          <span className="h-2 w-2 rounded-full" style={{ background: leaf }} />
        </span>
      );
    })}
  </span>
);

interface AppearancePopoverProps {
  open: boolean;
  onClose: () => void;
}

export const AppearancePopover: React.FC<AppearancePopoverProps> = ({ open, onClose }) => {
  const {
    mode,
    resolvedMode,
    seasonPreference,
    season,
    autoSeason,
    setMode,
    setSeasonPreference,
  } = useTheme();

  return (
    <Popover open={open} onClose={onClose} className="right-0 top-12 w-[300px]">
      <SectionLabel>Theme</SectionLabel>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {MODE_OPTIONS.map((option) => {
          const isActive = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              aria-pressed={isActive}
              className={cx(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition-colors cursor-pointer',
                isActive
                  ? 'border-accent-line bg-accent-wash text-accent-soft'
                  : 'border-hairline text-ink-soft hover:bg-inset hover:text-ink'
              )}
            >
              <option.icon className="h-4 w-4" />
              {option.label}
            </button>
          );
        })}
      </div>
      {mode === 'system' && (
        <p className="mt-2 text-[11px] text-ink-faint">
          Matching your system — currently {resolvedMode}.
        </p>
      )}

      <div className="mt-4">
        <SectionLabel>Season</SectionLabel>

        <button
          type="button"
          onClick={() => setSeasonPreference('auto')}
          aria-pressed={seasonPreference === 'auto'}
          className={cx(
            'mt-2 flex w-full flex-col gap-1.5 rounded-xl border p-2 transition-colors cursor-pointer',
            seasonPreference === 'auto'
              ? 'border-accent-line bg-accent-wash'
              : 'border-hairline hover:bg-inset'
          )}
        >
          <AutoSwatch mode={resolvedMode} />
          <span
            className={cx(
              'flex items-center gap-1.5 text-[11px] font-semibold',
              seasonPreference === 'auto' ? 'text-accent-soft' : 'text-ink-soft'
            )}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Follow the timeline
            <span className="ml-auto font-normal text-ink-faint">{SEASON_LABELS[autoSeason]}</span>
          </span>
        </button>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {SEASONS.map((option) => {
            const isActive = seasonPreference === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSeasonPreference(option)}
                aria-pressed={isActive}
                className={cx(
                  'flex flex-col gap-1.5 rounded-xl border p-2 transition-colors cursor-pointer',
                  isActive
                    ? 'border-accent-line bg-accent-wash'
                    : 'border-hairline hover:bg-inset'
                )}
              >
                <SeasonSwatch season={option} mode={resolvedMode} />
                <span
                  className={cx(
                    'text-[11px] font-semibold',
                    isActive ? 'text-accent-soft' : 'text-ink-soft'
                  )}
                >
                  {SEASON_LABELS[option]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 border-t border-hairline pt-3 text-[11px] text-ink-faint">
        {seasonPreference === 'auto'
          ? `The plot follows the month you scrub to. Showing ${SEASON_LABELS[season].toLowerCase()}.`
          : `Pinned to ${SEASON_LABELS[season].toLowerCase()} — scrubbing the timeline no longer changes the weather.`}
      </p>
    </Popover>
  );
};
