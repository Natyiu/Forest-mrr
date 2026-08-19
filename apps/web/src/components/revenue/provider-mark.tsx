import { cn } from "@/lib/utils";

import type { RevenueProvider } from "@/lib/revenue/providers";
import { PROVIDER_LOGOS } from "@/components/revenue/provider-logos";

/**
 * A provider's mark: its official glyph on its own brand tile.
 *
 * The one place in this app where a raw colour is right: a brand mark
 * identifies a company rather than encoding a value, so it must not shift with
 * the theme, the season, or the status of the row it sits on. Everything around
 * it is still tokens. The glyph is the real logo (see `provider-logos.tsx`),
 * drawn in white or near-black per the tile — a monogram letter stood here once
 * and six letters on six coloured squares read as a palette, not as six
 * companies.
 */
export function ProviderMark({
  provider,
  size = "default",
  className,
}: {
  provider: RevenueProvider;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const Logo = PROVIDER_LOGOS[provider.id];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center",
        size === "sm" && "size-5 rounded-[6px]",
        size === "default" && "size-7 rounded-[9px]",
        size === "lg" && "size-11 rounded-[13px]",
        className,
      )}
      style={{
        backgroundColor: provider.mark.brand,
        color: provider.mark.ink === "light" ? "#FFFFFF" : "#111827",
      }}
    >
      <Logo
        className={cn(
          size === "sm" && "size-3",
          size === "default" && "size-4",
          size === "lg" && "size-6",
        )}
      />
    </span>
  );
}
