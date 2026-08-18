"use client";

import { useEffect, useState, useTransition } from "react";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminFeedback,
  getAdminFeedbackStats,
  updateFeedbackStatus,
} from "@/lib/actions/feedback";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback-categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FeedbackSkeleton } from "@/components/skeletons";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "planned", label: "Planned" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/*
  Five categories in five identical grey pills is a label doing the work of a
  colour and failing at it. These are categorical — nothing is better or worse
  than its neighbour — so they take the decorative `pop` set rather than the
  status one.
*/
const CATEGORY_STYLES: Record<string, string> = {
  "feature-request": "bg-pop-violet/12 text-pop-violet",
  bug: "bg-pop-coral/12 text-pop-coral",
  improvement: "bg-pop-teal/14 text-pop-teal",
  question: "bg-pop-blue/12 text-pop-blue",
  other: "bg-muted text-muted-foreground",
};

/*
  Status *is* ordered — open needs attention, resolved does not — so this one
  reads as a ramp: loud at the end that wants a person, quiet at the end that
  is finished.
*/
const STATUS_STYLES: Record<string, string> = {
  open: "bg-primary text-primary-foreground",
  reviewed: "bg-info-soft text-info",
  planned: "bg-warn-soft text-warn",
  resolved: "bg-success-soft text-success",
  closed: "bg-muted text-muted-foreground",
};

function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

type FeedbackItem = {
  id: string;
  userId: string;
  category: string;
  message: string;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; email: string; image: string | null } | null;
};

export default function AdminFeedbackPage() {
  const [data, setData] = useState<{
    feedback: FeedbackItem[];
    total: number;
    pages: number;
    currentPage: number;
  } | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    open: number;
    reviewed: number;
    planned: number;
    resolved: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function loadData() {
    startTransition(async () => {
      const [feedbackData, statsData] = await Promise.all([
        getAdminFeedback({
          page,
          limit: 15,
          category: filterCategory,
          status: filterStatus,
        }),
        getAdminFeedbackStats(),
      ]);
      setData(feedbackData as typeof data);
      setStats(statsData);
    });
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterCategory, filterStatus]);

  async function handleStatusChange(
    id: string,
    newStatus: string,
    adminNote?: string
  ) {
    try {
      await updateFeedbackStatus(id, newStatus, adminNote);
      toast.success("Feedback updated");
      loadData();
    } catch {
      toast.error("Failed to update feedback");
    }
  }

  if (!data || !stats) return <FeedbackSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          User feedback, feature requests, and bug reports
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Total", value: stats.total },
          { label: "Open", value: stats.open },
          { label: "Reviewed", value: stats.reviewed },
          { label: "Planned", value: stats.planned },
          { label: "Resolved", value: stats.resolved },
        ].map((s) => (
          <div
            key={s.label}
            className="border border-border bg-card shadow-elev-1 p-3 rounded-xl"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {s.label}
            </p>
            <p className="text-lg font-semibold mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
          <SelectTrigger className="h-9 text-sm w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Categories</SelectItem>
            {FEEDBACK_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="h-9 text-sm w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {data.total} result{data.total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Feedback list */}
      {data.feedback.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-6 w-6 text-muted-foreground mb-3" />
          <p className="text-xs text-muted-foreground">No feedback yet</p>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border rounded-xl">
          {data.feedback.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.currentPage} of {data.pages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={page <= 1 || isPending}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={page >= data.pages || isPending}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackRow({
  item,
  expanded,
  onToggle,
  onStatusChange,
}: {
  item: FeedbackItem;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string, note?: string) => void;
}) {
  const [note, setNote] = useState(item.adminNote ?? "");
  const categoryLabel =
    FEEDBACK_CATEGORIES.find((c) => c.value === item.category)?.label ??
    item.category;

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left p-3 hover:bg-muted transition-colors"
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-6 w-6 shrink-0 mt-0.5">
            <AvatarImage src={item.user?.image ?? undefined} />
            <AvatarFallback className="text-[11px] font-bold bg-primary/10">
              {item.user?.name?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">
                {item.user?.name ?? "Unknown"}
              </span>
              <span
                className={`text-[11px] font-semibold px-1.5 py-px ${CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.other}`}
              >
                {categoryLabel}
              </span>
              <span
                className={`text-[11px] font-semibold px-1.5 py-px ${STATUS_STYLES[item.status] ?? STATUS_STYLES.open}`}
              >
                {item.status}
              </span>
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                {timeAgo(item.createdAt)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {item.message}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 ml-9 space-y-3 border-t border-border mt-0">
          <div className="pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              Full Message
            </p>
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">
              {item.message}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{item.user?.email}</span>
            <span>&middot;</span>
            <span>
              {new Date(item.createdAt).toLocaleString()}
            </span>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">
              Admin Note
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Status
            </p>
            <div className="flex items-center gap-1.5 ml-auto">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() =>
                    onStatusChange(item.id, s.value, note || undefined)
                  }
                  className={`text-[11px] font-semibold px-2 py-1 transition-colors ${
                    item.status === s.value
                      ? STATUS_STYLES[s.value]
                      : "bg-muted text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
