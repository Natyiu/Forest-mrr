"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Bell,
  Settings2,
  ToggleRight,
  Key,
  BarChart3,
  MessageSquare,
  ArrowLeft,
  FileText,
  CreditCard,
  Globe,
  Rocket,
  Shield,
  Megaphone,
} from "lucide-react";

const adminNav = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Blog", href: "/admin/blog", icon: FileText },
  { name: "Notifications", href: "/admin/notifications", icon: Bell },
  { name: "Products", href: "/admin/products", icon: CreditCard },
  { name: "Ads", href: "/admin/ads", icon: Megaphone },
  { name: "Feedback", href: "/admin/feedback", icon: MessageSquare },
  { name: "General", href: "/admin/general", icon: Settings2 },
  { name: "Site Settings", href: "/admin/site-settings", icon: Globe },
  { name: "Features", href: "/admin/features", icon: ToggleRight },
  { name: "API Keys", href: "/admin/api-keys", icon: Key },
  { name: "Deployment", href: "/admin/deployment", icon: Rocket },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card hidden md:flex flex-col fixed inset-y-0 left-0 z-40">
      {/* The mark, in the accent: one saturated tile is what says "this is the
          console and not the app" before a single label is read. */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border">
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-primary text-primary-foreground shrink-0">
          <Shield className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight leading-none">Admin</p>
          <p className="text-xs text-muted-foreground leading-none mt-1">Console</p>
        </div>
      </div>

      <nav className="px-3 py-4 space-y-0.5 flex-1 overflow-y-auto">
        {adminNav.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${
                  isActive
                    ? "bg-admin-wash text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* The theme moved to the top right, where it is on every other page. */}
      <div className="p-3 border-t border-border">
        <Link
          href={"/dashboard" as never}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to app
        </Link>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <div className="md:hidden flex items-center gap-2 mb-5">
      <div className="flex gap-1 overflow-x-auto flex-1 min-w-0">
        {adminNav.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={`
                shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
