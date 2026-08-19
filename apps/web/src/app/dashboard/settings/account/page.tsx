"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AccountSettingsSkeleton } from "@/components/skeletons";
import { SettingsCard } from "@/components/settings/settings-card";

export default function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return <AccountSettingsSkeleton />;
  if (!session) return null;

  async function handleDeleteAccount() {
    try {
      await authClient.deleteUser();
      toast.success("Account deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete account");
    }
  }

  return (
    <div className="space-y-4">
      <SettingsCard title="Sessions" description="Where this account is signed in.">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground">
            <Monitor className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">This device</p>
            <p className="truncate text-[12px] text-muted-foreground">
              {session.session.ipAddress ?? "Unknown IP"} ·{" "}
              {session.session.userAgent?.split(" ")[0] ?? "Unknown device"}
            </p>
          </div>
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-4xl bg-garden-wash px-2.5 text-[11px] font-semibold text-garden-soft">
            <span className="size-1.5 rounded-full bg-current" />
            Active
          </span>
        </div>
      </SettingsCard>

      {/*
        Its own card, and the last one. A destructive action beside a save button is
        a mis-click waiting to happen — the same rule the startup settings page
        keeps for delete.
      */}
      <SettingsCard
        tone="danger"
        title="Delete account"
        description="Your account, your startups and every connected key are removed. This cannot be undone."
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="h-9 rounded-full px-4 text-[13px]">
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-[15px]">Delete this account?</AlertDialogTitle>
              <AlertDialogDescription className="text-[12.5px]">
                This cannot be undone. Your profile, your startups and the keys they hold
                are deleted. The keys stay valid at each provider until you revoke them
                there — do that too.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-9 text-[13px]">Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="h-9 text-[13px]">
                Delete account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsCard>
    </div>
  );
}
