"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Check, X } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import { InvitationsSkeleton } from "@/components/skeletons";

type Invitation = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organization: { name: string; slug: string };
};

export default function InvitationsPage() {
  const [isPending, startTransition] = useTransition();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
    try {
      const { data } = await authClient.organization.listInvitations();
      setInvitations(
        ((data as unknown as Invitation[]) ?? []).filter(
          (i) => i.status === "pending",
        ),
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(invitationId: string) {
    startTransition(async () => {
      try {
        await authClient.organization.acceptInvitation({ invitationId });
        toast.success("Invitation accepted");
        loadInvitations();
      } catch {
        toast.error("Failed to accept invitation");
      }
    });
  }

  async function handleReject(invitationId: string) {
    startTransition(async () => {
      try {
        await authClient.organization.rejectInvitation({ invitationId });
        toast.success("Invitation declined");
        loadInvitations();
      } catch {
        toast.error("Failed to decline invitation");
      }
    });
  }

  if (loading) return <InvitationsSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Invitations</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pending invitations to join organizations.
        </p>
      </div>

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
          <Mail className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <h3 className="text-sm font-medium">No pending invitations</h3>
          <p className="text-xs text-muted-foreground mt-1">
            You&apos;ll see invitations here when someone invites you to an
            organization.
          </p>
        </div>
      ) : (
        <div className="border border-border divide-y divide-border rounded-xl">
          {invitations.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">
                  {inv.organization.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Invited as{" "}
                  <span className="font-medium">{inv.role}</span> —{" "}
                  expires{" "}
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleAccept(inv.id)}
                  disabled={isPending}
                >
                  <Check className="h-2.5 w-2.5" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleReject(inv.id)}
                  disabled={isPending}
                >
                  <X className="h-2.5 w-2.5" />
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
