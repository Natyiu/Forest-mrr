"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Paperclip,
} from "lucide-react";

import { Chip, IconButton, Surface, cx } from "@/garden/components/hud/ui";
import {
  getUserNotifications,
  markNotificationsSeen,
} from "@/lib/actions/notifications";
import { NOTIFICATION_TAGS } from "@/lib/notification-tags";

/**
 * **Notifications, in the garden's language.**
 *
 * A page inside the sidebar shell, written in the plot's vocabulary: one floating
 * `Surface` for the list, pill filters, and the headline typography the status block
 * uses. The shell supplies the ground, the breadcrumb and the way back, so this file
 * is only the inbox.
 *
 * It is built from the garden's own HUD primitives (`Surface`, `Chip`,
 * `IconButton`) and its tokens — `bg-page`, `bg-surface`, `text-ink`,
 * `bg-garden`. **Never a `dark:` utility in here:** that variant belongs to the
 * host app's `next-themes` class, while these tokens switch on `data-mode`, which
 * the root layout sets before first paint. They are already mode-aware, which is
 * why this page is correctly lit without the garden's ThemeProvider mounted.
 *
 * What is *not* borrowed is the season: with no `ThemeProvider` here the tokens sit
 * at their light-summer defaults from `index.css`. That is deliberate — the seasons
 * exist to say what month the plot is showing, and an inbox is not showing a month.
 *
 * **Opening this page is what marks the inbox read.** There is no "mark as read"
 * button and no per-row action: the badge on the bell counts what you have not
 * been shown, and this is the screen that shows it, so a badge that survives it
 * is asking to be dismissed twice. What the page keeps for the length of the
 * visit is *which* ones were waiting — see `newOnArrival`.
 */

/**
 * Tags are a categorical field with nothing to decode, so they get one quiet
 * treatment rather than eight colours competing with the unread dot — which is
 * the only thing on this page that means "look at me".
 */
const TAG_LABEL =
  "shrink-0 rounded-full bg-inset px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint";

type NotificationItem = {
  id: string;
  notificationId: string;
  title: string;
  description: string;
  tag: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [tagFilter, setTagFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /**
   * The ids that were unread when this visit began.
   *
   * Arriving marks everything read — that is the whole point, the badge is
   * counting things you have not been shown and this screen shows them — but
   * the rows keep drawing those as new until you leave. `read` on the record is
   * therefore useless to this page the moment it loads, and this set is what the
   * dots and the headline are drawn from instead. It survives the tag filters,
   * so switching to *Update* does not quietly settle the row you were reading.
   */
  const [newOnArrival, setNewOnArrival] = useState<Set<string>>(new Set());
  const seen = useRef(false);

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter]);

  /**
   * Once per visit, and before the first list is drawn: mark the inbox seen and
   * ask the server components above for a fresh count. The badge lives in
   * `dashboard/layout.tsx`, which is a server render this client page cannot
   * reach into — `router.refresh()` is the only thing that clears it without a
   * reload.
   */
  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    markNotificationsSeen().then((ids) => {
      if (ids.length === 0) return;
      setNewOnArrival(new Set(ids));
      router.refresh();
    });
  }, [router]);

  async function load(page: number) {
    const result = await getUserNotifications({
      tag: tagFilter === "all" ? undefined : tagFilter,
      page,
      limit: 15,
    });
    setNotifications(result.notifications as unknown as NotificationItem[]);
    setTotal(result.total);
    setPages(result.pages);
    setCurrentPage(result.currentPage);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const newCount = newOnArrival.size;

  function timeAgo(date: Date) {
    const now = new Date();
    const d = new Date(date);
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="flex flex-col gap-5">
        {/* The status block's shape: an eyebrow, a headline, one meta line. */}
        <header>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Notifications
            {newCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-garden" />}
          </p>
          <p className="mt-1 text-[54px] font-extrabold leading-[1] tracking-[-0.035em] text-ink">
            {newCount > 0 ? newCount : total}
          </p>
          {/*
            "New" rather than "unread", and it is the past tense on purpose: by
            the time this is on screen they have been read, because looking at
            them is what reading them means. The line still says which ones were
            waiting, which is the thing the badge was pointing at.
          */}
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] font-medium text-ink-faint">
            <span className="font-semibold text-ink-soft tabular-nums">
              {total} in total
            </span>
            <span aria-hidden>·</span>
            <span className={cx("tabular-nums", newCount > 0 && "font-semibold text-ink-soft")}>
              {newCount > 0
                ? `${newCount} new since you last looked`
                : "nothing new"}
            </span>
          </p>
        </header>

        {/* Filters as chips, the same vocabulary the plot filters with. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label="All tags"
            selected={tagFilter === "all"}
            onClick={() => setTagFilter("all")}
          />
          {NOTIFICATION_TAGS.map((tag) => (
            <Chip
              key={tag}
              label={tag.charAt(0).toUpperCase() + tag.slice(1)}
              selected={tagFilter === tag}
              onClick={() => setTagFilter(tag)}
            />
          ))}
        </div>

        {notifications.length === 0 ? (
          <Surface className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-inset text-ink-faint">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-ink">Nothing here</p>
            {/* Two different empties: an inbox with nothing in it, and a tag
                with nothing under it. The second one has a way out. */}
            <p className="mt-1 text-xs text-ink-soft">
              {tagFilter === "all"
                ? "You have not been sent anything yet."
                : `Nothing tagged ${tagFilter}.`}
            </p>
          </Surface>
        ) : (
          <Surface className="overflow-hidden">
            {notifications.map((n, index) => {
              const isExpanded = expandedId === n.id;
              const isNew = newOnArrival.has(n.id);

              return (
                <div key={n.id}>
                  {index > 0 && <div className="mx-4 h-px bg-hairline" />}

                  <button
                    type="button"
                    onClick={() => toggleExpand(n.id)}
                    className="w-full px-4 py-3.5 text-left transition-colors hover:bg-inset cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {/* The only saturated thing on the row: new this visit. */}
                      <span
                        aria-hidden
                        className={cx(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          isNew ? "bg-garden" : "bg-transparent",
                        )}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="mb-0.5 flex items-center gap-2">
                          <span
                            className={cx(
                              "truncate text-[13px]",
                              isNew ? "font-bold text-ink" : "font-medium text-ink-soft",
                            )}
                          >
                            {n.title}
                          </span>
                          <span className={TAG_LABEL}>{n.tag}</span>
                          {n.attachmentUrl && (
                            <Paperclip className="h-3 w-3 shrink-0 text-ink-faint" />
                          )}
                        </span>
                        <span className="block truncate text-[12px] text-ink-faint">
                          {n.description}
                        </span>
                      </span>

                      <span className="shrink-0 text-[11px] tabular-nums text-ink-faint">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-3 px-4 pb-4 pl-9">
                      <p className="border-l border-hairline pl-3 text-[12.5px] leading-relaxed text-ink-soft whitespace-pre-wrap">
                        {n.description}
                      </p>

                      {n.attachmentUrl && (
                        <a
                          href={n.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-inset px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-inset-strong hover:text-ink"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {n.attachmentName ?? "Download attachment"}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Surface>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-ink-faint">
              Page {currentPage} of {pages}
            </p>
            <Surface className="flex items-center gap-0.5 p-1">
              <IconButton
                icon={ChevronLeft}
                label="Previous page"
                onClick={() => currentPage > 1 && load(currentPage - 1)}
              />
              <IconButton
                icon={ChevronRight}
                label="Next page"
                onClick={() => currentPage < pages && load(currentPage + 1)}
              />
            </Surface>
          </div>
        )}

    </div>
  );
}
