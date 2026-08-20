import { XLogo } from "./x-logo";

/**
 * The designer credit, fixed in the bottom-left corner of every page —
 * the landing poster and the plot included.
 *
 * Bottom-left is the one corner nothing else claims: the plot's control bar
 * is bottom-center, its detail drawer and the toasts are bottom-right, and
 * the floating theme toggle is top-right. It is drawn with the garden's
 * `data-mode` tokens (`bg-surface-solid`, `text-ink-soft`, `border-hairline`),
 * which live on `:root` and are set before first paint, so it is correctly
 * lit in both modes on every page rather than only inside the plot.
 */
export function MadeByBadge() {
  return (
    <a
      href="https://x.com/DesignGuru01"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 rounded-full border border-hairline bg-surface-solid px-3 py-1.5 text-xs font-medium text-ink-soft shadow-elev-1 transition-opacity hover:opacity-80"
    >
      <span>Made by</span>
      <XLogo className="h-3 w-3 shrink-0" />
      <span>@DesignGuru01</span>
    </a>
  );
}
