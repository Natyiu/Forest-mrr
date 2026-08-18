"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { pageEnabled } from "@/lib/nav-features";
import { cn } from "@/lib/utils";

/**
 * Settings, in the garden's language.
 *
 * The tabs are pills rather than an underlined row, because every other selector in
 * this product is a pill — the plot's filters, the metric chips, the shape switch.
 * Two vocabularies for "pick one of these" is one too many.
 *
 * The palette comes from `garden-skin` on the shell above, so these use the garden's
 * own tokens (`text-ink`, `bg-inset`, `bg-garden`) directly rather than shadcn's.
 */
const settingsNav = [
  { name: "Profile", href: "/dashboard/settings", page: "settings" as const },
  { name: "Account", href: "/dashboard/settings/account", page: "settings" as const },
  // The appearance tab is the other surface of the account menu's *App appearance*,
  // so one switch has to govern both or the row disappears and the tab does not.
  { name: "Appearance", href: "/dashboard/settings/appearance", page: "appearance" as const },
].filter((item) => pageEnabled(item.page));

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    /*
      One centred column for the heading, the tabs and the page, at the width the
      startups screen uses. The three used to be a full-width block hugging the left
      edge under a bar that spans the window, which reads as a page that failed to
      load the rest of itself.
    */
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
          Settings
        </p>
        <h1 className="mt-1.5 text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink">
          Your account
        </h1>
        <p className="mt-2.5 text-[13.5px] text-ink-soft">
          Profile, sign-in and how the app looks. Startups have their own tab, up top.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        {settingsNav.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                isActive
                  ? "bg-garden text-garden-ink"
                  : "bg-inset text-ink-soft hover:bg-inset-strong hover:text-ink",
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
