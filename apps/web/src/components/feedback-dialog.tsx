"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitFeedback } from "@/lib/actions/feedback";
import { FEEDBACK_CATEGORIES } from "@/lib/feedback-categories";

type FeedbackDialogProps = {
  /** When provided, dialog is controlled and no trigger is rendered (e.g. for dropdown use) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function FeedbackDialog({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: FeedbackDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange : setInternalOpen;
  const [category, setCategory] = useState<string>("feature-request");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    startTransition(async () => {
      try {
        await submitFeedback({ category, message });
        toast.success("Feedback sent — thank you!");
        setMessage("");
        setCategory("feature-request");
        setOpen(false);
      } catch {
        toast.error("Failed to send feedback");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <button className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-medium">
            <MessageSquarePlus className="h-3 w-3" />
            Send Feedback
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md rounded-none!">
        <DialogHeader>
          <DialogTitle className="text-sm">Send Feedback</DialogTitle>
          <DialogDescription className="text-[11px]">
            Help us improve — share a bug, idea, or suggestion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">
              Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 block">
              Message
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your feedback..."
              className="min-h-[100px] text-xs resize-none"
              maxLength={2000}
            />
            <p className="text-[10px] text-muted-foreground/40 text-right mt-1">
              {message.length}/2000
            </p>
          </div>
        </div>

        <DialogFooter className="rounded-none!">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !message.trim()}
            size="sm"
            className="text-xs h-8"
          >
            {isPending ? "Sending..." : "Send Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
