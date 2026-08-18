"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Maximize2, Minimize2, X } from "lucide-react";

import { ThemeProvider } from "@/garden/lib/ThemeContext";
import { IconButton } from "@/garden/components/hud/ui";

const GardenApp = dynamic(() => import("@/garden/App"), {
  ssr: false,
  loading: () => <div className="garden-root h-full w-full bg-page" />,
});

/** How long the corner controls stay up after the last pointer movement. */
const CONTROLS_MS = 2600;

/**
 * **The wall display.**
 *
 * `/dashboard/tv` — the plot on an office screen, and nothing on top of it. The
 * beds and the metric border are the reading; `clean` mode renders the canvas
 * full-bleed and no HUD at all. This file is only the things a screen on a wall
 * needs that a screen on a desk does not.
 *
 * - **The display is kept awake.** A browser tab does not stop a TV going to
 *   sleep, and a board nobody touches for four hours is precisely the case this
 *   mode exists for. The Wake Lock is re-taken on `visibilitychange`, because
 *   the browser drops it whenever the tab is backgrounded and never gives it
 *   back on its own.
 * - **The controls fade.** Fullscreen and the way out sit in a corner and
 *   disappear a couple of seconds after the last pointer movement, along with
 *   the cursor. A permanent button is furniture on a screen whose whole point is
 *   that it has none; no button at all is a mode you cannot leave, which is
 *   worse. They come back when the mouse does.
 * - **Nothing is stored.** No preference, no local state that outlives the tab.
 *   Point a kiosk browser at this URL and the board is whatever the data says.
 *
 * It sits under `/dashboard`, so the layout's auth check already applies: an
 * office screen signs in once and stays signed in, which is the same trust
 * boundary as leaving the dashboard open on a laptop in the same room.
 */
export function TvView() {
  const { theme, setTheme } = useTheme();
  const [controlsUp, setControlsUp] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const wake = useCallback(() => {
    setControlsUp(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsUp(false), CONTROLS_MS);
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [wake]);

  // Keep the panel lit. `wakeLock` is absent on Safari < 16.4 and on any
  // insecure origin, so every step is optional and failure is silent — a board
  // that works and dims is better than one that throws.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let released = false;

    async function take() {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Denied, unsupported, or the tab is not visible. Nothing to do.
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible" && !released) void take();
    }

    void take();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  return (
    <ThemeProvider
      mode={theme === "light" || theme === "dark" ? theme : "system"}
      onModeChange={setTheme}
    >
      <div
        onPointerMove={wake}
        className={`relative h-screen w-screen overflow-hidden ${controlsUp ? "" : "cursor-none"}`}
      >
        <GardenApp clean />

        <div
          className={`absolute bottom-[3vh] right-[3vw] z-40 flex items-center gap-1 transition-opacity duration-500 ${
            controlsUp ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <IconButton
            icon={isFullscreen ? Minimize2 : Maximize2}
            label={isFullscreen ? "Leave fullscreen" : "Fullscreen"}
            onClick={toggleFullscreen}
          />
          <Link href="/dashboard" aria-label="Close the wall display" title="Close the wall display">
            <IconButton icon={X} label="Close the wall display" onClick={() => {}} />
          </Link>
        </div>
      </div>
    </ThemeProvider>
  );
}
