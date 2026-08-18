"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Activity,
  UserPlus,
  CheckCircle,
  Building2,
  Bell,
  BarChart3,
  ArrowRight,
  ArrowUpRight,
  Send,
  Globe,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { getOverview } from "@/lib/actions/admin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MiniWorldMap } from "@/components/world-map";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback-categories";
import { OverviewSkeleton } from "@/components/skeletons";

type Overview = Awaited<ReturnType<typeof getOverview>>;

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const h = 24;
  const w = 64;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => ({
    x: i * step,
    y: h - (v / max) * (h - 3) - 1.5,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path
        d={line}
        fill="none"
        className="stroke-primary"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r={2.5}
        className="fill-primary"
      />
    </svg>
  );
}

function RingGauge({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-admin-soft"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-primary transition-all duration-500"
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={circ - filled}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* The small tinted square that carries an icon. One shape, used everywhere a
   figure or a row needs a glyph, so a reader never has to work out whether two
   differently-drawn icons mean different things. */
function IconChip({
  icon: Icon,
  tone = "muted",
}: {
  icon: React.ElementType;
  tone?: "muted" | "accent";
}) {
  return (
    <span
      className={`grid place-items-center h-8 w-8 rounded-lg shrink-0 ${
        tone === "accent"
          ? "bg-admin-wash text-primary"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

/* A KPI cell. The strip is one card divided by hairlines rather than four
   floating cards, because these four numbers are read together — dividing them
   says "one reading in four parts" where a gap says "four unrelated things". */
function Stat({
  label,
  icon,
  children,
  footer,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 px-5 pt-5">
        <IconChip icon={icon} />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      <div className="px-5 pt-3 pb-4 flex-1">{children}</div>
      <div className="px-5 py-2.5 border-t border-border text-xs text-muted-foreground">
        {footer}
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  href,
  children,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-border bg-card rounded-xl overflow-hidden ${className}`}
    >
      <header className="flex items-center justify-between px-5 h-14 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">{title}</h2>
        </div>
        {href && (
          <Link
            href={href as never}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverview()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <OverviewSkeleton />;

  const { stats, sparkline, recentUsers, recentNotifications, recentFeedback, countries } = data;
  const signupSpark = sparkline.map((s) => s.signups);
  const activeSpark = sparkline.map((s) => s.active);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A snapshot of your product, right now.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            getOverview()
              .then(setData)
              .finally(() => setLoading(false));
          }}
          className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Row 1: Key metrics — one card, four cells, hairline dividers */}
      <div className="border border-border bg-card rounded-xl grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border overflow-hidden">
        <Stat
          label="Total users"
          icon={Users}
          footer={
            <span className="flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-admin-up" />
              <span className="text-admin-up font-medium">
                +{stats.usersLast7d}
              </span>
              this week
            </span>
          }
        >
          <div className="flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight leading-none">
              {stats.totalUsers}
            </p>
            <Sparkline data={signupSpark} />
          </div>
        </Stat>

        <Stat
          label="Active today"
          icon={Activity}
          footer={
            <span>
              <span className="text-foreground font-medium">
                {stats.weeklyActiveUsers}
              </span>{" "}
              this week
            </span>
          }
        >
          <div className="flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tracking-tight leading-none">
              {stats.dailyActiveUsers}
            </p>
            <Sparkline data={activeSpark} />
          </div>
        </Stat>

        <Stat
          label="Onboarding"
          icon={CheckCircle}
          footer={
            <span>
              {stats.onboardedUsers} of {stats.totalUsers} completed
            </span>
          }
        >
          <div className="flex items-center gap-3">
            <RingGauge value={stats.onboardingRate} />
            <p className="text-3xl font-semibold tracking-tight leading-none">
              {stats.onboardingRate}%
            </p>
          </div>
        </Stat>

        <Stat
          label="Notifications"
          icon={Bell}
          footer={<span>read rate</span>}
        >
          <div className="flex items-center gap-3">
            <RingGauge value={stats.notificationReadRate} />
            <p className="text-3xl font-semibold tracking-tight leading-none">
              {stats.notificationReadRate}%
            </p>
          </div>
        </Stat>
      </div>

      {/* Row 2: Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: UserPlus,
            value: `+${stats.usersLast30d}`,
            label: "signups (30d)",
          },
          {
            icon: Building2,
            value: `${stats.totalOrgs}`,
            label: `orgs · ${stats.totalMembers} members`,
          },
          {
            icon: Send,
            value: `${stats.totalNotifications}`,
            label: "notifications sent",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="border border-border bg-card rounded-xl px-5 py-4 flex items-center gap-3"
          >
            <IconChip icon={s.icon} tone="accent" />
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight leading-none">
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Row 3: Recent users + Recent notifications side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Recent users" href="/admin/users" icon={Users}>
          <div className="divide-y divide-border">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No users yet
              </p>
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.image ?? ""} />
                    <AvatarFallback className="text-xs font-semibold bg-admin-wash text-primary">
                      {u.name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.role === "admin" && (
                      <Badge variant="default" className="text-[11px]">
                        admin
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(u.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="Recent notifications"
          href="/admin/notifications"
          icon={Bell}
        >
          <div className="divide-y divide-border">
            {recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No notifications sent yet
              </p>
            ) : (
              recentNotifications.map((n) => (
                <div key={n.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[11px]">
                        {n.tag}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        → {n.recipientCount} recipient
                        {n.recipientCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Row 4: Mini map + Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={"/admin/analytics" as never}
          className="border border-border bg-card rounded-xl overflow-hidden block hover:border-primary/40 transition-colors group"
        >
          <div className="flex items-center justify-between px-5 h-14 border-b border-border">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">User locations</h2>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="p-4">
            <MiniWorldMap countries={countries} />
          </div>
        </Link>

        <div className="md:col-span-2 flex flex-col">
          <p className="text-sm font-medium mb-3">Quick links</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {[
              {
                href: "/admin/users",
                label: "Users",
                icon: Users,
                desc: "Manage roles & access",
              },
              {
                href: "/admin/analytics",
                label: "Analytics",
                icon: BarChart3,
                desc: "Growth & engagement",
              },
              {
                href: "/admin/notifications",
                label: "Notifications",
                icon: Bell,
                desc: "Send messages",
              },
              {
                href: "/admin/general",
                label: "Settings",
                icon: CheckCircle,
                desc: "App config & features",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href as never}
                className="flex items-center gap-3 px-5 py-4 border border-border bg-card rounded-xl hover:border-primary/40 transition-colors group"
              >
                <IconChip icon={item.icon} tone="accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.desc}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Feedback */}
      <Panel title="Feedback" href="/admin/feedback" icon={MessageSquare}>
        {recentFeedback.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            No feedback yet
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border">
              <span className="text-xs text-muted-foreground">
                {stats.totalFeedback} total
              </span>
              <span className="text-xs text-muted-foreground">&middot;</span>
              <span className="text-xs font-medium">
                {stats.openFeedback} open
              </span>
            </div>
            <div className="divide-y divide-border">
              {recentFeedback.map((f) => {
                const catLabel =
                  FEEDBACK_CATEGORIES.find((c) => c.value === f.category)
                    ?.label ?? f.category;
                return (
                  <div key={f.id} className="px-5 py-3 flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={f.user?.image ?? ""} />
                      <AvatarFallback className="text-xs font-semibold bg-admin-wash text-primary">
                        {f.user?.name?.charAt(0).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {f.user?.name ?? "Unknown"}
                        </span>
                        <Badge variant="secondary" className="text-[11px]">
                          {catLabel}
                        </Badge>
                        <Badge
                          variant={f.status === "open" ? "default" : "outline"}
                          className="text-[11px]"
                        >
                          {f.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {f.message}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {timeAgo(f.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
