"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

/**
 * **One theme, on every page.**
 *
 * This app has two stylesheets that answer to different switches. shadcn reads
 * the `.dark` class, which `next-themes` owns; the garden's tokens read
 * `data-mode`, which the plot used to set for itself. That was two dark modes,
 * and they only agreed by coincidence: turning the plot dark and then opening
 * Settings gave you a white page, and leaving the plot *deleted* `data-mode` on
 * the way out, so every page after it was lit by whatever the pre-paint script
 * had guessed on the last full load.
 *
 * There is one switch now. `next-themes` is the owner — it is the one with a
 * storage key, an OS listener and a pre-paint script already — and this mirrors
 * its resolved value onto `data-mode` for the whole document. The garden's
 * `ThemeProvider` no longer writes or clears that attribute when it is hosted;
 * it only adds `data-season` on top, because a season is not a mode.
 *
 * It renders nothing. `resolvedTheme` is undefined until `next-themes` has read
 * storage, which is one tick after mount — the inline script in the root layout
 * covers that tick so nothing flashes.
 */
export function ThemeSync() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  /**
   * On `/embed` the mode is the *founder's*, pinned by the URL — that page is a
   * frame inside a site somebody else designed, and mirroring the visitor's own
   * preference onto it would repaint a surface the visitor does not own. The
   * embed page writes `data-mode` itself; this stands aside there and only there.
   */
  const isEmbed = usePathname().startsWith("/embed");

  /**
   * There are two modes now, light and dark. A browser that stored `system`
   * back when that was a choice would otherwise hand next-themes a value it has
   * no class for; it is settled to light — the default — once, on arrival.
   */
  useEffect(() => {
    if (theme && theme !== "light" && theme !== "dark") setTheme("light");
  }, [theme, setTheme]);

  useEffect(() => {
    if (isEmbed) return;
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const root = document.documentElement;
    root.dataset.mode = resolvedTheme;
    // Native widgets — scrollbars, form controls, the scrubber's thumb — are
    // painted by the browser and this is the only thing that tells it which way.
    root.style.colorScheme = resolvedTheme;
  }, [isEmbed, resolvedTheme]);

  return null;
}
