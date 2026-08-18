"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BarChart3,
  CreditCard,
  LogOut,
  MessageSquarePlus,
  Expand,
  Settings,
  ShieldCheck,
  Sliders,
  User,
} from "lucide-react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconButton, Popover, cx } from "@/garden/components/hud/ui";
import { authClient } from "@/lib/auth-client";
import { pageEnabled } from "@/lib/nav-features";

/**
 * Who is signed in, inside the plot.
 *
 * The garden is the whole of `/dashboard`, so the app's header bar is gone from
 * this route and everything it carried has to be reachable from the toolbar
 * instead.
 *
 * It is built from the *garden's* HUD primitives rather than from shadcn, on
 * purpose. The two style systems answer to different theme owners — shadcn
 * follows `next-themes`, the garden follows its own mode-and-season — and a
 * shadcn popover opening over a winter-midnight plot is a white card on a black
 * field. Borrowing `Surface` and `IconButton` means this menu is lit by
 * whatever season the plot is in, for free.
 *
 * `FeedbackDialog` is the exception: it is the host app's modal, it is opened
 * rarely and deliberately, and it is a form rather than a piece of chrome. Like the
 * rows above it, it is only mounted while `ENABLED_PAGES` offers a way in.
 */

export interface GardenAccountProps {
  name: string;
  email: string;
  image?: string | null;
  isAdmin: boolean;
  unreadNotifications: number;
}

export function GardenAccount({
  name,
  email,
  image,
  isAdmin,
  unreadNotifications,
}: GardenAccountProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const initial = name.charAt(0).toUpperCase() || "?";

  const go = (href: string) => {
    setOpen(false);
    router.push(href as never);
  };

  const items: Array<{
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    run: () => void;
  }> = [
    ...(pageEnabled("revenue")
      ? [
          {
            id: "revenue-data",
            icon: BarChart3,
            label: "Revenue data",
            run: () => go("/dashboard/revenue"),
          },
        ]
      : []),
    /*
      The clean view. The plot's toolbar has a button for it too; this row is
      what makes it reachable from the pages, which have no toolbar. Same label
      and same icon in both places — one destination under two names is two
      destinations as far as a reader is concerned.
    */
    {
      id: "clean",
      icon: Expand,
      label: "Clean view",
      run: () => go("/dashboard/tv"),
    },
    { id: "settings", icon: Settings, label: "Settings", run: () => go("/dashboard/settings") },
    { id: "account", icon: User, label: "Account", run: () => go("/dashboard/settings/account") },
    ...(pageEnabled("appearance")
      ? [
          {
            id: "appearance",
            icon: Sliders,
            label: "App appearance",
            run: () => go("/dashboard/settings/appearance"),
          },
        ]
      : []),
    ...(pageEnabled("pricing")
      ? [{ id: "pricing", icon: CreditCard, label: "Pricing", run: () => go("/pricing") }]
      : []),
    ...(pageEnabled("feedback")
      ? [
          {
            id: "feedback",
            icon: MessageSquarePlus,
            label: "Send feedback",
            run: () => {
              setOpen(false);
              setFeedbackOpen(true);
            },
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            id: "admin",
            icon: ShieldCheck,
            label: "Admin dashboard",
            run: () => go("/admin"),
          },
        ]
      : []),
  ];

  return (
    <div className="relative flex items-center gap-0.5">
      {/*
        Light/dark, in the same corner of every page in the app — the plot, the
        inbox, settings, the ledger. It is here rather than in the account menu
        because a theme is something people flick rather than navigate to, and
        it is *only* here: the plot's appearance popover used to carry a second
        copy and now keeps the season, which is the thing only it has.
      */}
      <ThemeToggle />

      <IconButton
        icon={Bell}
        label={
          unreadNotifications > 0
            ? `Notifications (${unreadNotifications} unread)`
            : "Notifications"
        }
        onClick={() => router.push("/dashboard/notifications" as never)}
        // The badge is the count, not a dot: "how many" is the only reason to
        // look at an inbox before opening it.
        badge={unreadNotifications > 99 ? 99 : unreadNotifications || undefined}
      />

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        className={cx(
          "grid h-9 w-9 place-items-center rounded-xl transition-colors cursor-pointer",
          open ? "bg-inset" : "hover:bg-inset"
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-[26px] w-[26px] rounded-full object-cover ring-1 ring-hairline"
          />
        ) : (
          <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-garden text-[11px] font-bold text-garden-ink">
            {initial}
          </span>
        )}
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        className="right-0 top-12 w-[240px] p-2"
      >
        <div className="px-2 pb-2 pt-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
          <p className="truncate text-[11px] text-ink-faint">{email}</p>
        </div>

        <div className="my-1 h-px bg-hairline" />

        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.run}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:bg-inset hover:text-ink cursor-pointer"
          >
            <item.icon className="h-[15px] w-[15px]" />
            {item.label}
          </button>
        ))}

        <div className="my-1 h-px bg-hairline" />

        <button
          type="button"
          onClick={() =>
            authClient.signOut({
              fetchOptions: { onSuccess: () => window.location.assign("/") },
            })
          }
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-danger-ink transition-colors hover:bg-danger-wash cursor-pointer"
        >
          <LogOut className="h-[15px] w-[15px]" />
          Sign out
        </button>
      </Popover>

      {pageEnabled("feedback") && (
        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      )}
    </div>
  );
}
