import { cn } from "@/lib/utils";

import type { RevenueProvider } from "@/lib/revenue/providers";

/**
 * A provider's monogram tile.
 *
 * The one place in this app where a raw colour is right: a brand mark
 * identifies a company rather than encoding a value, so it must not shift with
 * the theme, the season, or the status of the row it sits on. Everything around
 * it is still tokens.
 */
export function ProviderMark({
  provider,
  size = "default",
  className,
}: {
  provider: RevenueProvider;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center font-bold leading-none",
        size === "sm" ? "size-5 rounded-[6px] text-[9px]" : "size-7 rounded-[9px] text-[11px]",
        className,
      )}
      style={{
        backgroundColor: provider.mark.brand,
        color: provider.mark.ink === "light" ? "#FFFFFF" : "#111827",
      }}
    >
      {provider.mark.initials}
    </span>
  );
}
