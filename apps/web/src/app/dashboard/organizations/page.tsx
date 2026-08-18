"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Users,
  Mail,
  Crown,
  UserMinus,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { getAuthConfig } from "@/lib/actions/user";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OrganizationsSkeleton } from "@/components/skeletons";

type Org = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: string | Date;
  members?: { id: string; userId: string; role: string; user?: { name: string; email: string; image?: string | null } }[];
};

export default function OrganizationsPage() {
  const { data: session } = authClient.useSession();
  const [isPending, startTransition] = useTransition();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<{ organizationsEnabled: boolean; invitesEnabled: boolean } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [configResult] = await Promise.all([getAuthConfig()]);
      setConfig(configResult);

      if (!configResult.organizationsEnabled) {
        setLoading(false);
        return;
      }

      const { data: orgList } = await authClient.organization.list();
      const list = (orgList as unknown as Org[]) ?? [];
      setOrgs(list);

      if (list.length > 0) {
        await loadOrgDetails(list[0].id);
      }
    } catch {
      // Org feature might not be available
    } finally {
      setLoading(false);
    }
  }

  async function loadOrgDetails(orgId: string) {
    try {
      const { data: full } = await authClient.organization.getFullOrganization({
        query: { organizationId: orgId },
      });
      if (full) setActiveOrg(full as unknown as Org);
    } catch {
      // ignore
    }
  }

  async function handleCreate() {
    if (!newName.trim() || !newSlug.trim()) return;
    startTransition(async () => {
      try {
        const { data } = await authClient.organization.create({
          name: newName.trim(),
          slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        });
        if (data) {
          toast.success("Organization created");
          setCreateOpen(false);
          setNewName("");
          setNewSlug("");
          await loadData();
        }
      } catch {
        toast.error("Failed to create organization");
      }
    });
  }

  async function handleSwitchOrg(orgId: string) {
    startTransition(async () => {
      try {
        await authClient.organization.setActive({ organizationId: orgId });
      } catch {
        // setActive may not exist in some versions
      }
      await loadOrgDetails(orgId);
      toast.success("Switched organization");
    });
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !activeOrg) return;
    startTransition(async () => {
      try {
        await authClient.organization.inviteMember({
          email: inviteEmail.trim(),
          role: inviteRole as "member" | "admin",
          organizationId: activeOrg.id,
        });
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteOpen(false);
        setInviteEmail("");
        setInviteRole("member");
        await loadOrgDetails(activeOrg.id);
      } catch {
        toast.error("Failed to send invitation");
      }
    });
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeOrg) return;
    startTransition(async () => {
      try {
        await authClient.organization.removeMember({
          memberIdOrEmail: memberId,
          organizationId: activeOrg.id,
        });
        toast.success("Member removed");
        await loadOrgDetails(activeOrg.id);
      } catch {
        toast.error("Failed to remove member");
      }
    });
  }

  if (loading) return <OrganizationsSkeleton />;

  if (!config?.organizationsEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organizations are currently disabled by the admin.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
          <Building2 className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <p className="text-xs text-muted-foreground">This feature is not enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage your teams.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-xs gap-1.5">
              <Plus className="h-3 w-3" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-sm">Create Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input
                placeholder="Organization name"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }}
                className="text-sm"
              />
              <Input
                placeholder="slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                className="text-sm text-muted-foreground"
              />
              <Button
                onClick={handleCreate}
                disabled={isPending || !newName.trim()}
                size="sm"
                className="w-full text-xs"
              >
                {isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Org list */}
      {orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-xl">
          <Building2 className="h-10 w-10 text-muted-foreground/20 mb-4" />
          <h3 className="text-sm font-medium">No organizations</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Create your first organization to start collaborating.
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {orgs.map((org) => {
            const isActive = activeOrg?.id === org.id;
            return (
              <button
                key={org.id}
                onClick={() => handleSwitchOrg(org.id)}
                className={`w-full text-left border p-3 transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">{org.name}</p>
                    <p className="text-[10px] text-muted-foreground">/{org.slug}</p>
                  </div>
                  {isActive && (
                    <span className="text-[8px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5">
                      Active
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active org details */}
      {activeOrg && (
        <div className="border border-border rounded-xl">
          <div className="border-b border-border px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{activeOrg.name}</h2>
              <p className="text-[10px] text-muted-foreground">
                {activeOrg.members?.length ?? 0} member{(activeOrg.members?.length ?? 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-1.5">
              {config?.invitesEnabled && (
                <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 h-7">
                      <Mail className="h-3 w-3" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="text-sm">Invite Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <Input
                        placeholder="Email address"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="text-sm"
                      />
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="text-sm h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleInvite}
                        disabled={isPending || !inviteEmail.trim()}
                        size="sm"
                        className="w-full text-xs"
                      >
                        {isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <div className="divide-y divide-border">
            {activeOrg.members?.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 bg-primary/10 border border-border flex items-center justify-center shrink-0 rounded-xl">
                    <span className="text-[9px] font-bold text-primary">
                      {member.user?.name?.charAt(0).toUpperCase() ?? "?"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">
                        {member.user?.name ?? "Unnamed"}
                      </p>
                      {member.role === "owner" && (
                        <Crown className="h-2.5 w-2.5 text-pop-yellow" />
                      )}
                      <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1 py-px">
                        {member.role}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {member.user?.email}
                    </p>
                  </div>
                </div>
                {member.userId !== session?.user.id && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={isPending}
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}

            {(!activeOrg.members || activeOrg.members.length === 0) && (
              <div className="p-6 text-center">
                <Users className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No members yet</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
