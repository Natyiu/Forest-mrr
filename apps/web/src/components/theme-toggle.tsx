"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { IconButton } from "@/garden/components/hud/ui";

/**
 * **The theme switch, and there is only one of it.**
 *
 * It cycles light → dark → system rather than opening a menu, because three
 * states is a cycle and a two-item popover for a two-and-a-half-state setting is
 * a click of ceremony. The icon says which state it is *in* — sun, moon, or the
 * monitor that means "whatever the machine says" — not which it would go to.
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

const NEXT: Record<string, string> = { light: "dark", dark: "system", system: "light" };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  /**
   * `theme` is undefined until next-themes has read storage, and rendering the
   * eventual icon before then is a hydration mismatch — the server has no idea
   * which one it will be. The monitor is the honest placeholder: `system` is
   * also the default.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const current = ready ? theme ?? "system" : "system";
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <IconButton
      icon={Icon}
      label={`Theme: ${current}. Switch to ${NEXT[current] ?? "light"}.`}
      onClick={() => setTheme(NEXT[current] ?? "light")}
    />
  );
}

/**
 * The same switch, parked in the top-right corner of pages that have no chrome
 * of their own — auth, onboarding, legal, verify-email.
 *
 * It stands down wherever a page already puts the toggle in a header of its own:
 * `/dashboard` and `/admin` carry it in their top bar, and the landing page has
 * one in its nav. Two of these on one screen is the thing this whole change was
 * meant to stop — and on a page with a sticky header they would overlap, since
 * both want the same corner.
 */
const OWNS_ITS_OWN = ["/dashboard", "/admin"];

export function FloatingThemeToggle() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  if (OWNS_ITS_OWN.some((route) => pathname.startsWith(route))) return null;

  return (
    <div className="fixed right-4 top-4 z-50">
      <ThemeToggle />
    </div>
  );
}
