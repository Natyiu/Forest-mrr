'use client';

import React from 'react';
import {
  CHROME_VARS,
  type ResolvedMode,
  type Season,
  type SeasonPreference,
  type Theme,
  type ThemeMode,
  getTheme,
} from './theme';

/**
 * The one place that decides what the app looks like.
 *
 * Two preferences are stored — mode and season — and each can defer to
 * something outside itself: `system` asks the OS, `auto` asks the timeline.
 * Everything downstream consumes the *resolved* pair, so no component has to
 * know that a preference can be a question rather than an answer.
 */

const MODE_KEY = 'allotment:mode';
const SEASON_KEY = 'allotment:season';

interface ThemeContextValue {
  /** What the user picked, which may be `system`. */
  mode: ThemeMode;
  /** What that resolves to right now. */
  resolvedMode: ResolvedMode;
  /** What the user picked, which may be `auto`. */
  seasonPreference: SeasonPreference;
  /** What that resolves to right now. */
  season: Season;
  /** The season the timeline is currently sitting in. */
  autoSeason: Season;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  setSeasonPreference: (season: SeasonPreference) => void;
  /** Called by the timeline so `auto` has something to follow. */
  setAutoSeason: (season: Season) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private mode, or storage disabled. Fall through to the default.
  }
  return 'system';
}

function readStoredSeason(): SeasonPreference {
  try {
    const stored = localStorage.getItem(SEASON_KEY);
    if (
      stored === 'auto' || stored === 'spring' || stored === 'summer' ||
      stored === 'autumn' || stored === 'winter'
    ) {
      return stored;
    }
  } catch {
    // As above.
  }
  return 'auto';
}

function systemMode(): ResolvedMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Light/dark, owned by the host application.
   *
   * Standalone, the garden stores its own mode and writes its own `data-mode` —
   * it is the whole app, so there is nobody to defer to. Mounted inside one, it
   * must not be: two stores for one preference is two dark modes, and a reader
   * who turns the plot dark and then opens Settings to a white page has met the
   * bug rather than the feature. `apps/web` passes the host's value here and
   * `onModeChange` back, so the palette control on the plot and the toggle in
   * the top bar are the same switch.
   *
   * Season stays the garden's own either way: a season is not a mode, and the
   * rest of the app has no opinion about which month the plot is dressed for.
   */
  mode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  mode: hostMode,
  onModeChange,
}) => {
  const hosted = hostMode !== undefined;
  // The defaults, not the stored preferences. This renders on the server as
  // well as the client, and a first render that reads `localStorage` disagrees
  // with the HTML the server sent — React throws the whole subtree away and
  // re-renders it. The stored values are adopted in the effect below, one tick
  // later, which is invisible: the tokens are painted in a layout effect that
  // has not run yet either.
  const [ownMode, setModeState] = React.useState<ThemeMode>('system');
  const [seasonPreference, setSeasonState] = React.useState<SeasonPreference>('auto');
  const [systemPrefers, setSystemPrefers] = React.useState<ResolvedMode>('light');
  const [autoSeason, setAutoSeason] = React.useState<Season>('summer');

  const mode = hosted ? hostMode : ownMode;

  React.useEffect(() => {
    if (!hosted) setModeState(readStoredMode());
    setSeasonState(readStoredSeason());
    setSystemPrefers(systemMode());
  }, [hosted]);

  // Follow the OS while the preference is `system` — someone whose machine
  // flips at sunset should see the garden flip with it, without a reload.
  React.useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemPrefers(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolvedMode: ResolvedMode = mode === 'system' ? systemPrefers : mode;
  const season: Season = seasonPreference === 'auto' ? autoSeason : seasonPreference;
  const theme = React.useMemo(() => getTheme(resolvedMode, season), [resolvedMode, season]);

  // Paint the tokens onto <html> before the browser draws this commit, so the
  // HUD never flashes the previous palette.
  //
  // `<html>` rather than the garden's own container because the plot's modals
  // and popovers are portalled to the body, and a token that only exists
  // inside the plot is a token a modal cannot read. It is safe to write at the
  // root because these names are namespaced away from the host app's — see the
  // note on CHROME_VARS in `theme.ts`.
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    (Object.keys(CHROME_VARS) as Array<keyof typeof CHROME_VARS>).forEach((token) => {
      root.style.setProperty(CHROME_VARS[token], theme.chrome[token]);
    });
    root.dataset.season = theme.season;
    if (!hosted) {
      root.dataset.mode = theme.mode;
      // Tells the browser to render native widgets (scrollbars, form controls,
      // the range input's thumb) in the matching scheme.
      root.style.colorScheme = theme.mode;
    }

    // The garden is one route inside a larger app, and the tokens it painted
    // would otherwise follow the reader out of it. `data-mode` and
    // `color-scheme` are *not* cleaned up when hosted, because there they are
    // not the garden's to clean: the host sets them on every page, and undoing
    // that on the way out of the plot is what used to turn the next page light.
    return () => {
      delete root.dataset.season;
      if (!hosted) {
        delete root.dataset.mode;
        root.style.colorScheme = '';
      }
      (Object.keys(CHROME_VARS) as Array<keyof typeof CHROME_VARS>).forEach((token) => {
        root.style.removeProperty(CHROME_VARS[token]);
      });
    };
  }, [theme, hosted]);

  const setMode = React.useCallback((next: ThemeMode) => {
    if (hosted) {
      onModeChange?.(next);
      return;
    }
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Preference is still honoured for this session.
    }
  }, [hosted, onModeChange]);

  const setSeasonPreference = React.useCallback((next: SeasonPreference) => {
    setSeasonState(next);
    try {
      localStorage.setItem(SEASON_KEY, next);
    } catch {
      // As above.
    }
  }, []);

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      seasonPreference,
      season,
      autoSeason,
      theme,
      setMode,
      setSeasonPreference,
      setAutoSeason,
    }),
    [mode, resolvedMode, seasonPreference, season, autoSeason, theme, setMode, setSeasonPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const value = React.useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

/**
 * The same context, for components that render both inside the plot and out.
 * On the plot it returns the live provider, so a season change applies to the
 * canvas mid-breath; on an ordinary page there is no provider and it returns
 * null, and the caller falls back to writing the stored preference directly.
 */
export function useOptionalTheme(): ThemeContextValue | null {
  return React.useContext(ThemeContext);
}
