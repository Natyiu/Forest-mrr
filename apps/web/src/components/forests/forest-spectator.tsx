"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { ThemeProvider } from "@/garden/lib/ThemeContext";

const GardenApp = dynamic(() => import("@/garden/App"), {
  ssr: false,
  loading: () => <div className="garden-root h-full w-full" />,
});

/**
 * Somebody else's forest, watched through the plot's own renderer.
 *
 * This is `spectate` mode pointed at a public startup: the canvas and nothing
 * on top of it — no toolbar, no scrubber, no drawers, no plant selection — but
 * the metric border stays a working menu: hover explains a specimen, a click
 * re-beds the plot as that metric, all in the viewer's own browser. `bookQuery`
 * sends `startup=<id>` with the two book fetches, and the server decides
 * whether this viewer may have that book at all.
 *
 * Client-only for the same reason the plot is everywhere else: a canvas on a
 * requestAnimationFrame loop has no useful HTML for a server to send.
 */
export function ForestSpectator({ startupId }: { startupId: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <ThemeProvider
      mode={theme === "light" || theme === "dark" ? theme : "system"}
      onModeChange={setTheme}
    >
      <div className="garden-root h-full w-full">
        <GardenApp spectate bookQuery={`startup=${encodeURIComponent(startupId)}`} />
      </div>
    </ThemeProvider>
  );
}
