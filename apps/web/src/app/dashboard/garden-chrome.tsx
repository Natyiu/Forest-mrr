"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Settings, Sprout, Trees } from "lucide-react";

import { Surface, cx } from "@/garden/components/hud/ui";

/**
 * The plot's brand mark and its three ways out.
 *
 * Both are the host app's, handed to `garden/App` as nodes for the same reason the
 * account menu is: the garden is a self-contained port and knows nothing about this
 * app's routes. They are built from the HUD primitives so they are lit by whatever
 * season the plot is in.
 */

/**
 * The wordmark — the FOREST MRR lockup, in two cuts.
 *
 * **`public/forest-mrr.svg` (`#147E12`) is the light one and stays the light one;
 * `public/forest-mrr-dark.svg` (`#78FFA5`) is drawn on dark.** Each is only ever
 * shown against the page it was drawn for, and the numbers are why there are two
 * rather than one:
 *
 * | | on the pale page | on the dark page |
 * | --- | --- | --- |
 * | `#147E12` | **4.56:1** | 3.79:1 |
 * | `#78FFA5` | 1.10:1 | **15.69:1** |
 *
 * The dark green cleared the 3:1 a graphic this size answers to, so it was legible
 * at night rather than wrong — but only just, and "just legible" is not what a brand
 * mark is for. The mint is unreadable in daylight, which is the same argument in the
 * other direction: neither cut can do both jobs, so each does one.
 *
 * Both are served as images so they keep their own hex. An earlier attempt painted
 * the mark as a CSS mask tinted with `bg-garden-soft`, which fails for a reason no
 * amount of contrast fixes: `--garden-soft` is *seasonal* — emerald in summer, rust
 * in October, blue in winter — and a brand mark that changes hue with the month is
 * not a brand mark.
 *
 * The swap is CSS, not state: both are in the DOM and `dark:` hides one. A
 * `resolvedTheme` read would render the wrong mark on the server and correct it a
 * tick later, which is a visible flicker on every page load for a decision the
 * stylesheet can make before the first paint. `display: none` also takes the hidden
 * one out of the accessibility tree, so the alt text is not announced twice.
 *
 * Sized by the artwork's own ratio at 44px tall — 1246×588 and 4775×2255 land within
 * a tenth of a pixel of each other at that height — so a rounded height can never
 * squash either.
 */
export function GardenBrand() {
  return (
    <Link
      href="/dashboard"
      title="Forest MRR"
      aria-label="Forest MRR — back to the garden"
      className="block transition-opacity hover:opacity-80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/forest-mrr.svg"
          alt="Forest MRR"
          width={93}
          height={44}
          className="h-9 w-[76px] dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/forest-mrr-dark.svg"
          alt="Forest MRR"
          width={93}
          height={44}
          className="hidden h-9 w-[76px] dark:block"
        />
    </Link>
  );
}

/**
 * Garden · Startups · Settings, as one segmented pill.
 *
 * On **every** page, not just the plot: it is the app's only navigation, so it is
 * also the way back from wherever you went. Three icons rather than three words —
 * the row sits dead centre above a scene, and labels there would read as part of it.
 *
 * The three destinations are disjoint, which they were not when startups lived at
 * `/dashboard/settings/revenue`: pressing *Startups* lit *Settings* too, because one
 * was inside the other. Startups is its own route now, so each button opens its own
 * thing and nothing else.
 */
const TABS = [
  { href: "/dashboard", label: "My forest", icon: Sprout, exact: true },
  { href: "/dashboard/forests", label: "Startups", icon: Trees, exact: false },
  { href: "/dashboard/startups", label: "My startups", icon: Building2, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: false },
];

export function GardenNav() {
  const pathname = usePathname();

  return (
    <Surface className="flex items-center gap-0.5 px-1.5 py-1.5">
      {TABS.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href as never}
            title={tab.label}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
            className={cx(
              "flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors sm:px-3.5",
              isActive ? "bg-garden text-garden-ink" : "text-ink-soft hover:bg-inset hover:text-ink",
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        );
      })}
    </Surface>
  );
}
