"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Send,
  Paperclip,
  X,
  Users,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Plus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  sendNotification,
  sendNotificationToAll,
  getAdminNotificationHistory,
  searchUsers,
} from "@/lib/actions/notifications";
import { NOTIFICATION_TAGS } from "@/lib/notification-tags";
import { uploadFile } from "@/lib/supabase";

const TAG_COLORS: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  announcement: "bg-info-soft text-info",
  update: "bg-success-soft text-success",
  maintenance: "bg-warn-soft text-warn",
  security: "bg-destructive-soft text-destructive",
  billing: "bg-pop-violet/12 text-pop-violet",
  feature: "bg-pop-teal/14 text-pop-teal",
  urgent: "bg-destructive-soft text-destructive",
};

type UserOption = { id: string; name: string | null; email: string };

type HistoryItem = {
  id: string;
  title: string;
  description: string;
  tag: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  senderId: string;
  createdAt: Date;
  recipientCount: number;
  readCount: number;
};

export default function AdminNotificationsPage() {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("general");
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userSearching, setUserSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    loadHistory(1);
  }, []);

  const doUserSearch = useCallback(async (query: string) => {
    setUserSearching(true);
    try {
      const result = await searchUsers(query);
      setUsers(result);
    } catch {
      // ignore
    } finally {
      setUserSearching(false);
    }
  }, []);

  useEffect(() => {
    if (sendToAll) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      doUserSearch(userSearch);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [userSearch, sendToAll, doUserSearch]);

  async function loadHistory(page: number) {
    const result = await getAdminNotificationHistory({ page, limit: 10 });
    setHistory(result.notifications as unknown as HistoryItem[]);
    setHistoryPages(result.pages);
    setHistoryPage(page);
    setHistoryTotal(result.total);
  }

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  const filteredUsers = users;

  async function handleSend() {
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");
    if (!sendToAll && selectedUsers.length === 0) {
      return toast.error("Select at least one recipient");
    }

    startTransition(async () => {
      try {
        let attachmentUrl: string | undefined;
        let attachmentName: string | undefined;

        if (attachment) {
          const path = `notifications/${Date.now()}-${attachment.name}`;
          const result = await uploadFile("attachments", path, attachment);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          attachmentUrl = result.url;
          attachmentName = attachment.name;
        }

        if (sendToAll) {
          await sendNotificationToAll({
            title: title.trim(),
            description: description.trim(),
            tag,
            attachmentUrl,
            attachmentName,
          });
        } else {
          await sendNotification({
            title: title.trim(),
            description: description.trim(),
            tag,
            attachmentUrl,
            attachmentName,
            recipientIds: selectedUsers,
          });
        }

        toast.success("Notification sent");
        setTitle("");
        setDescription("");
        setTag("general");
        setAttachment(null);
        setSelectedUsers([]);
        setSendToAll(true);
        setCreateOpen(false);
        loadHistory(1);
      } catch {
        toast.error("Failed to send notification");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Compose and send messages to your users.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Create message
        </Button>
      </div>

      {/* Create message dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Create message</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="notif-title" className="text-sm font-medium">
                  Title
                </Label>
                <Input
                  id="notif-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title..."
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notif-tag" className="text-sm font-medium">
                  Tag
                </Label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger id="notif-tag" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TAGS.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        <span className="capitalize">{t}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-desc" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="notif-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write the notification body..."
                rows={4}
                className="text-xs resize-none"
              />
            </div>

            {/* Attachment */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Attachment (optional)
              </Label>
              {attachment ? (
                <div className="flex items-center gap-2 border border-input rounded-md p-2.5 bg-muted">
                  <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">
                    {attachment.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {(attachment.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 border border-dashed border-input rounded-md p-3 cursor-pointer hover:bg-muted transition-colors">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Click to attach a file
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setAttachment(file);
                    }}
                  />
                </label>
              )}
            </div>

            {/* Recipients */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-to-all"
                  checked={sendToAll}
                  onCheckedChange={(c) => setSendToAll(!!c)}
                />
                <Label
                  htmlFor="send-to-all"
                  className="text-sm font-medium cursor-pointer"
                >
                  Send to all users
                </Label>
              </div>

              {!sendToAll && (
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="p-2 border-b border-border relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search users by name or email..."
                      className="h-9 text-xs pl-8"
                    />
                    {userSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-border">
                    {filteredUsers.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedUsers.includes(u.id)}
                          onCheckedChange={() => toggleUser(u.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">
                            {u.name ?? "Unnamed"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                      </label>
                    ))}
                    {filteredUsers.length === 0 && !userSearching && (
                      <p className="p-3 text-xs text-muted-foreground text-center">
                        {userSearch ? "No users found" : "Type to search users..."}
                      </p>
                    )}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="p-2 border-t border-border bg-muted">
                      <p className="text-xs text-muted-foreground">
                        {selectedUsers.length} user
                        {selectedUsers.length !== 1 ? "s" : ""} selected
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSend}
              disabled={isPending}
              size="sm"
              className="h-9 text-xs gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {isPending ? "Sending..." : "Send Notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History section */}
      <div className="border border-border bg-card shadow-elev-1 rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs font-semibold">Sent History</p>
            <p className="text-xs text-muted-foreground">
              {historyTotal} notification{historyTotal !== 1 ? "s" : ""} sent
            </p>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Send className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-xs text-muted-foreground">
              No notifications sent yet
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {history.map((item) => (
                <div key={item.id} className="p-4 hover:bg-muted transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xs font-semibold truncate">
                          {item.title}
                        </h3>
                        <span
                          className={`text-[11px] font-semibold px-1.5 py-px ${TAG_COLORS[item.tag] ?? TAG_COLORS.general}`}
                        >
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                      {item.attachmentName && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Paperclip className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {item.attachmentName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Users className="h-2.5 w-2.5" />
                          {item.recipientCount}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Eye className="h-2.5 w-2.5" />
                          {item.readCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {historyPages > 1 && (
              <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {historyPage} of {historyPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={historyPage <= 1}
                    onClick={() => loadHistory(historyPage - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={historyPage >= historyPages}
                    onClick={() => loadHistory(historyPage + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
