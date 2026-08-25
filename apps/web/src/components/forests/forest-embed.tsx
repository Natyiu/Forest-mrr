"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect } from "react";

import { ThemeProvider } from "@/garden/lib/ThemeContext";

const GardenApp = dynamic(() => import("@/garden/App"), {
  ssr: false,
  loading: () => <div className="garden-root h-full w-full" />,
});

const noop = () => {};

/**
 * A forest inside somebody else's page.
 *
 * This is `spectate` mode reached through an embed token rather than a session:
 * the canvas and the working metric border, nothing on top, standing transparent
 * on whatever the host site put behind the iframe. `bookQuery` sends
 * `embed=<token>` with the two book fetches and the server decides whether that
 * token still opens anything.
 *
 * **The theme is the founder's choice, not the visitor's.** An embed lives on a
 * page somebody designed — `?theme=dark` on the iframe URL is them saying which
 * of their surfaces it stands on — so the mode arrives as a prop and is pinned:
 * the garden's `ThemeProvider` gets it with a no-op `onModeChange` so it defers
 * without ever writing storage, and the effect below owns `data-mode` because
 * `ThemeSync` (which mirrors the *visitor's* preference, and stands down on
 * `/embed`) is the wrong voice on a page the visitor does not own.
 */
export function ForestEmbed({ token, mode }: { token: string; mode: "light" | "dark" }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = mode;
    root.style.colorScheme = mode;
  }, [mode]);

  return (
    <ThemeProvider mode={mode} onModeChange={noop}>
      <div className="garden-root h-full w-full">
        <GardenApp spectate bookQuery={`embed=${encodeURIComponent(token)}`} />
      </div>
    </ThemeProvider>
  );
}
