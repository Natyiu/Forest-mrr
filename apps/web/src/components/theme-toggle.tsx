"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { IconButton } from "@/garden/components/hud/ui";

/**
 * **The theme switch, and there is only one of it.**
 *
 * Two states, light and dark, and it flips between them. There is no *system*
 * setting any more: it was a third state for a preference almost nobody set
 * deliberately, and it meant the app could change mode on its own when the OS
 * did, with nothing on screen saying why. The icon says which state it is *in*
 * — sun or moon — not which it would go to.
 *
 * `next-themes` is the owner (see `theme-sync.tsx`), so pressing this changes
 * the *whole app*: the shadcn `.dark` class and the garden's `data-mode` move
 * together, and the plot's own appearance control is this same switch reached
 * from a different button.
 *
 * It is drawn with the garden's `IconButton` deliberately. That primitive is
 * built on `data-mode` tokens which live on `:root`, so it is correctly lit on
 * every page in the app rather than only inside the plot — and it means the
 * control looks the same in the plot's floating toolbar as it does on a settings
 * page, which is the point of having one of it.
 */

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  /**
   * `resolvedTheme` is undefined until next-themes has read storage, and
   * rendering the eventual icon before then is a hydration mismatch — the server
   * has no idea which one it will be. Light is the placeholder because light is
   * the default, so for most people the icon never changes.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const current = ready && resolvedTheme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";

  return (
    <IconButton
      icon={current === "dark" ? Moon : Sun}
      label={`Theme: ${current}. Switch to ${next}.`}
      onClick={() => setTheme(next)}
    />
  );
}

/**
 * The same switch, parked in the top-right corner of pages that have no chrome
 * of their own — auth, legal, verify-email.
 *
 * It stands down wherever a page already puts the toggle in a header of its own:
 * `/dashboard` and `/admin` carry it in their top bar, and the landing page has
 * one in its nav. Two of these on one screen is the thing this whole change was
 * meant to stop — and on a page with a sticky header they would overlap, since
 * both want the same corner.
 *
 * The auth screens go without one entirely: they are a painted poster like the
 * landing band, half the screen is artwork that ignores the theme anyway, and a
 * person passing through a login is not there to change settings.
 */
const OWNS_ITS_OWN = ["/dashboard", "/admin"];
const NO_TOGGLE = ["/signup", "/login", "/forgot-password", "/reset-password"];

export function FloatingThemeToggle() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  if (OWNS_ITS_OWN.some((route) => pathname.startsWith(route))) return null;
  if (NO_TOGGLE.some((route) => pathname.startsWith(route))) return null;

  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>
  );
}
