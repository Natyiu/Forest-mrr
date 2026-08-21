"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { ArrowUpRight, Bell, Building2, Code, CreditCard, Settings } from "lucide-react";

import { Surface } from "@/garden/components/hud/ui";

import { GardenAccount } from "./garden-account";
import { GardenBrand, GardenNav } from "./garden-chrome";
import type { StartupView } from "@/lib/startups";

function BatLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M50 0C50 0 42 14 30 18C18 22 0 18 0 18C0 18 12 28 20 32C28 36 50 40 50 40C50 40 72 36 80 32C88 28 100 18 100 18C100 18 82 22 70 18C58 14 50 0 50 0Z" />
    </svg>
  );
}

export function DashboardShell({
  children,
  session,
  unreadNotifications = 0,
  organizationsEnabled = false,
  startups = [],
  activeId = null,
}: {
  children: React.ReactNode;
  session: typeof authClient.$Infer.Session;
  unreadNotifications?: number;
  organizationsEnabled?: boolean;
  /** The sidebar's own list: which businesses exist, and which is open. */
  startups?: StartupView[];
  activeId?: string | "all" | null;
}) {
  const pathname = usePathname();
  const isAdmin = session.user.role === "admin";
  /**
   * The plot is the one route that draws its own chrome.
   *
   * `/dashboard/tv` is bare for the opposite reason: it draws *no* chrome. A wall
   * display with this app's top bar on it is a wall display advertising a nav
   * nobody standing four metres away can click.
   *
   * It is a canvas read by eye and it has a toolbar of its own, so a sidebar beside
   * it would take a fifth of the ground the trees stand on. Every *page* — the
   * inbox, the ledger, the graphs, settings — lives in the sidebar shell below,
   * which is what makes them one product rather than four.
   */
  const isBare = pathname === "/dashboard" || pathname === "/dashboard/tv";
  const userImage = session.user.image;
  const userName = session.user.name ?? "";
  const userEmail = session.user.email ?? "";

  // The garden is the whole page. Its own toolbar carries the account, the
  // notifications and the way out (see `garden-account.tsx`), so a second bar
  // above it would be a strip of chrome over a scene that has no room for one —
  // and two logos' worth of vertical space taken off a plot that is read by
  // eye. Every other dashboard route keeps the header and the padded column.
  if (isBare) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-background">{children}</div>
    );
  }

  /*
    **One shell, and it is the plot's own bar.**

    The same three bands on every page — wordmark, the three-way nav, the account
    cluster — because that bar *is* the app's navigation, which makes it also the way
    back from wherever you went. A sidebar here and a floating bar on the plot meant
    two navigations for one product, and the one you learned on the first screen was
    not the one on the second.

    The palette is the token bridge (`garden-skin`, see `index.css`), so every page
    inside is lit like the plot without being touched.
  */
  return (
    <div className="garden-root garden-skin min-h-screen bg-page text-ink">
      <header className="relative z-30 flex items-center justify-between gap-4 px-6 py-4">
        <GardenBrand />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <GardenNav />
        </div>

        <Surface className="flex items-center gap-0.5 p-1">
          <GardenAccount
            name={userName}
            email={userEmail}
            image={userImage}
            isAdmin={isAdmin}
            unreadNotifications={unreadNotifications}
          />
        </Surface>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-6">{children}</main>
    </div>
  );
}

export function DashboardHome({
  userName,
  organizationsEnabled = false,
}: {
  userName?: string;
  organizationsEnabled?: boolean;
}) {
  const firstName = userName?.split(" ")[0] ?? "there";

  const features = [
    {
      label: "Notifications",
      href: "/dashboard/notifications",
      icon: Bell,
      desc: "In-app messaging with tags, filters, and read tracking",
    },
    {
      label: "Settings",
      href: "/dashboard/settings",
      icon: Settings,
      desc: "Profile, account, appearance, and password",
    },
    {
      label: "Pro",
      href: "/dashboard/pro",
      icon: CreditCard,
      desc: "Subscription-protected premium features",
    },
    ...(organizationsEnabled
      ? [
          {
            label: "Organizations",
            href: "/dashboard/organizations",
            icon: Building2,
            desc: "Teams, members, roles, and invitations",
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl relative">
      <div className="mb-6">
        <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-widest mb-1">
          User Dashboard
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Hey, {firstName}
        </h1>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          These are the features that come built-in. Build your product
          on top of them.
        </p>
      </div>

      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-3">
          Features included
        </p>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${features.length}, minmax(0, 1fr))` }}
        >
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href as never}
              className="flex flex-col justify-between gap-2 p-3 group border border-dashed border-border/40 hover:bg-muted/50 transition-colors rounded-xl"
            >
              <div className="flex items-center justify-between">
                <f.icon className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground/70 transition-colors" />
                <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-foreground/80 transition-colors" />
              </div>
              <div>
                <p className="text-xs font-medium group-hover:text-foreground transition-colors">
                  {f.label}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-snug">
                  {f.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="border border-dashed border-border/40 px-4 py-4 mb-16 rounded-xl">
        <div className="flex items-start gap-2">
          <Code className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground/80">
              Start building
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Edit{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded-sm font-mono text-xs">
                app/dashboard/page.tsx
              </code>{" "}
              to replace this page with your product&apos;s home experience.
              The layout, auth, and features above are ready to use.
            </p>
          </div>
        </div>
      </div>

      {/* The feedback dialog lives in the account menu now (`garden-account.tsx`),
          so this unused export no longer floats a second copy of it. */}
    </div>
  );
}
