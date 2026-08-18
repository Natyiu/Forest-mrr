/**
 * **Which pages the app offers a way into.**
 *
 * The same arrangement `ENABLED_SHAPES` uses for the city and the aquarium, and
 * `ENABLED_FEATURES` for the advisor and the guide: a list with the switched-off
 * entries commented out, read by every surface that would otherwise link to them.
 *
 * A page that is off has to be off **everywhere at once** — the sidebar row, the
 * account menu, and every cross-link between pages — because a nav item that leads
 * somewhere the product no longer offers is worse than no item, and a "View data"
 * button on a page whose data view is gone is a dead end with a label.
 *
 * **The routes themselves are untouched.** `/dashboard/revenue` and
 * `/dashboard/graph` still exist, still work, and still read the active startup's
 * book; nothing was deleted, exactly as the sprite files for the city and the
 * aquarium are still there. Uncomment a line to put the way back.
 */
export const ENABLED_PAGES = [
  "garden",
  "inbox",
  "settings",
  // "revenue",     // /dashboard/revenue — the imported-data ledger
  // "graphs",      // /dashboard/graph   — the charts
  // "appearance",  // /dashboard/settings/appearance — the app's light/dark tab
  // "pricing",     // /pricing — the plans page
  // "feedback",    // the feedback dialog, wherever it is offered
] as const;

export type AppPage =
  | "garden"
  | "inbox"
  | "revenue"
  | "graphs"
  | "settings"
  | "appearance"
  | "pricing"
  | "feedback";

export const pageEnabled = (page: AppPage): boolean =>
  (ENABLED_PAGES as readonly string[]).includes(page);
