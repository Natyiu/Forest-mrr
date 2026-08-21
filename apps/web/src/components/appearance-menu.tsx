"use client";

import { useEffect, useState } from "react";
import { useTheme as useNextTheme } from "next-themes";
import { Moon, Palette, Sun, Wand2 } from "lucide-react";

import { IconButton, Popover, SectionLabel, cx } from "@/garden/components/hud/ui";
import { SEASONS, SEASON_LABELS, type Season, seasonSwatch } from "@/garden/lib/theme";
import { useOptionalTheme } from "@/garden/lib/ThemeContext";

/**
 * **Appearance is one setting now: theme and season behind one button.**
 *
 * The sun/moon toggle and the plot's palette popover were two controls for what
 * a person experiences as one thing — how the app looks. This palette button
 * replaces the toggle in the account cluster on every dashboard page *and* the
 * plot, and opens both choices at once: light or dark for the whole app, and
 * the season the plot is dressed for.
 *
 * Theme goes through next-themes, the app-wide owner. Season goes through the
 * garden's ThemeProvider when this renders inside the plot — live, the canvas
 * changes under the open menu — and falls back to writing the stored
 * preference (`allotment:season`) on ordinary pages, where the plot adopts it
 * on its next visit.
 */

const SEASON_KEY = "allotment:season";
type SeasonPreference = Season | "auto";

const isSeasonPreference = (value: string | null): value is SeasonPreference =>
  value === "auto" || (SEASONS as readonly string[]).includes(value ?? "");

/** Turf and canopy for one season, at swatch size. */
function SeasonSwatch({ season, mode }: { season: Season; mode: "light" | "dark" }) {
  const [turf, leaf] = seasonSwatch(season, mode);
  return (
    <span
      className="grid h-7 w-full place-items-center rounded-xl ring-1 ring-inset ring-black/10"
      style={{ background: turf }}
    >
      <span className="h-3.5 w-3.5 rounded-full" style={{ background: leaf }} />
    </span>
  );
}

/** All four at once, for the option that refuses to pick one. */
function AutoSwatch({ mode }: { mode: "light" | "dark" }) {
  return (
    <span className="flex h-7 w-full overflow-hidden rounded-xl ring-1 ring-inset ring-black/10">
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
}

export function AppearanceMenu() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const garden = useOptionalTheme();

  const [open, setOpen] = useState(false);

  // Hydration guard, as on the old toggle: light until storage has been read.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const mode: "light" | "dark" = ready && resolvedTheme === "dark" ? "dark" : "light";

  // Off the plot there is no provider; the stored preference is the state.
  const [storedSeason, setStoredSeason] = useState<SeasonPreference>("auto");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEASON_KEY);
      if (isSeasonPreference(raw)) setStoredSeason(raw);
    } catch {
      // The default stands.
    }
  }, []);

  const seasonPreference = garden ? garden.seasonPreference : storedSeason;
  const setSeasonPreference = (next: SeasonPreference) => {
    if (garden) {
      garden.setSeasonPreference(next);
      return;
    }
    setStoredSeason(next);
    try {
      localStorage.setItem(SEASON_KEY, next);
    } catch {
      // Honoured for this page view regardless.
    }
  };

  return (
    <div className="relative">
      <IconButton
        icon={Palette}
        label="Appearance: theme and season"
        onClick={() => setOpen((current) => !current)}
      />

      <AppearanceBody
        open={open}
        onClose={() => setOpen(false)}
        mode={mode}
        onMode={(next) => setTheme(next)}
        seasonPreference={seasonPreference}
        onSeason={setSeasonPreference}
        autoLabel={garden ? SEASON_LABELS[garden.autoSeason] : null}
      />
    </div>
  );
}

function AppearanceBody({
  open,
  onClose,
  mode,
  onMode,
  seasonPreference,
  onSeason,
  autoLabel,
}: {
  open: boolean;
  onClose: () => void;
  mode: "light" | "dark";
  onMode: (next: "light" | "dark") => void;
  seasonPreference: SeasonPreference;
  onSeason: (next: SeasonPreference) => void;
  autoLabel: string | null;
}) {
  return (
    <Popover open={open} onClose={onClose} className="right-0 top-12 w-[300px] p-4">
      <SectionLabel>Theme</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {(
          [
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
          ] as const
        ).map((option) => {
          const isActive = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onMode(option.value)}
              aria-pressed={isActive}
              className={cx(
                "flex items-center justify-center gap-1.5 rounded-2xl border p-2.5 text-[11px] font-semibold transition-colors cursor-pointer",
                isActive
                  ? "border-garden-line bg-garden-wash text-garden-soft"
                  : "border-hairline text-ink-soft hover:bg-inset",
              )}
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-hairline pt-3">
        <SectionLabel>Season</SectionLabel>
      </div>

      <button
        type="button"
        onClick={() => onSeason("auto")}
        aria-pressed={seasonPreference === "auto"}
        className={cx(
          "mt-2 flex w-full flex-col gap-1.5 rounded-2xl border p-2 transition-colors cursor-pointer",
          seasonPreference === "auto"
            ? "border-garden-line bg-garden-wash"
            : "border-hairline hover:bg-inset",
        )}
      >
        <AutoSwatch mode={mode} />
        <span
          className={cx(
            "flex items-center gap-1.5 text-[11px] font-semibold",
            seasonPreference === "auto" ? "text-garden-soft" : "text-ink-soft",
          )}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Follow the timeline
          {autoLabel && <span className="ml-auto font-normal text-ink-faint">{autoLabel}</span>}
        </span>
      </button>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {SEASONS.map((option) => {
          const isActive = seasonPreference === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSeason(option)}
              aria-pressed={isActive}
              className={cx(
                "flex flex-col gap-1.5 rounded-2xl border p-2 transition-colors cursor-pointer",
                isActive ? "border-garden-line bg-garden-wash" : "border-hairline hover:bg-inset",
              )}
            >
              <SeasonSwatch season={option} mode={mode} />
              <span
                className={cx(
                  "text-[11px] font-semibold",
                  isActive ? "text-garden-soft" : "text-ink-soft",
                )}
              >
                {SEASON_LABELS[option]}
              </span>
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
