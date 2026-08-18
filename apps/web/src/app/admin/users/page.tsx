"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Ban,
  UserCheck,
  UserX,
  Pencil,
  MoreHorizontal,
  Download,
  ArrowUpDown,
  Filter,
  X,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  image: string | null;
  createdAt: Date;
};

type SortField = "name" | "email" | "createdAt" | "role";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 15;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filters
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const filtersActive = filterRole !== "all" || filterStatus !== "all";

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allOnPageSelected =
    users.length > 0 && users.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0;

  // Dialogs
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banExpiry, setBanExpiry] = useState("");

  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState("");

  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  // Bulk dialogs
  const [bulkAction, setBulkAction] = useState<
    "ban" | "unban" | "role" | "remove" | null
  >(null);
  const [bulkRole, setBulkRole] = useState("user");
  const [bulkBanReason, setBulkBanReason] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          sortBy: sortField,
          sortDirection: sortDir,
          ...(search
            ? {
                searchValue: search,
                searchField: "email" as const,
                searchOperator: "contains" as const,
              }
            : {}),
          ...(filterRole !== "all" ? { filterField: "role" as const, filterValue: filterRole, filterOperator: "eq" as const } : {}),
        },
      });
      if (res.data) {
        let filtered = res.data.users as User[];
        if (filterStatus === "banned") {
          filtered = filtered.filter((u) => u.banned);
        } else if (filterStatus === "active") {
          filtered = filtered.filter((u) => !u.banned);
        }
        setUsers(filtered);
        setTotal(res.data.total);
      }
    } catch {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [page, search, sortField, sortDir, filterRole, filterStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setSelected(new Set());
  }, [page, search, filterRole, filterStatus]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(users.map((u) => u.id)));
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  }

  // Individual actions
  async function handleSetRole(userId: string, role: string) {
    try {
      await authClient.admin.setRole({
        userId,
        role: role as "admin" | "user",
      });
      toast.success(`Role updated to ${role}`);
      setRoleTarget(null);
      fetchUsers();
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function handleBan(userId: string, reason: string, expiry?: string) {
    try {
      await authClient.admin.banUser({
        userId,
        banReason: reason || "Banned by admin",
        ...(expiry ? { banExpiresIn: Math.floor((new Date(expiry).getTime() - Date.now()) / 1000) } : {}),
      });
      toast.success("User banned");
      setBanTarget(null);
      setBanReason("");
      setBanExpiry("");
      fetchUsers();
    } catch {
      toast.error("Failed to ban user");
    }
  }

  async function handleUnban(userId: string) {
    try {
      await authClient.admin.unbanUser({ userId });
      toast.success("User unbanned");
      fetchUsers();
    } catch {
      toast.error("Failed to unban user");
    }
  }

  async function handleRemove(userId: string) {
    try {
      await authClient.admin.removeUser({ userId });
      toast.success("User removed");
      setRemoveTarget(null);
      fetchUsers();
    } catch {
      toast.error("Failed to remove user");
    }
  }

  async function handleEditSave() {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const updates: Record<string, string> = {};
      if (editName && editName !== editUser.name) updates.name = editName;
      if (editEmail && editEmail !== editUser.email) updates.email = editEmail;

      if (Object.keys(updates).length > 0) {
        const { error } = await authClient.admin.updateUser({
          userId: editUser.id,
          data: updates,
        });
        if (error) throw error;
      }
      if (editPassword) {
        const { error } = await authClient.admin.setUserPassword({
          userId: editUser.id,
          newPassword: editPassword,
        });
        if (error) throw error;
      }
      toast.success("User updated");
      setEditUser(null);
      fetchUsers();
    } catch {
      toast.error("Failed to update user");
    } finally {
      setEditSaving(false);
    }
  }

  // Bulk actions
  async function executeBulkAction() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    let success = 0;
    let failed = 0;

    if (bulkAction === "ban") {
      for (const id of ids) {
        try {
          await authClient.admin.banUser({
            userId: id,
            banReason: bulkBanReason || "Banned by admin (bulk)",
          });
          success++;
        } catch {
          failed++;
        }
      }
    } else if (bulkAction === "unban") {
      for (const id of ids) {
        try {
          await authClient.admin.unbanUser({ userId: id });
          success++;
        } catch {
          failed++;
        }
      }
    } else if (bulkAction === "role") {
      for (const id of ids) {
        try {
          await authClient.admin.setRole({
            userId: id,
            role: bulkRole as "admin" | "user",
          });
          success++;
        } catch {
          failed++;
        }
      }
    } else if (bulkAction === "remove") {
      for (const id of ids) {
        try {
          await authClient.admin.removeUser({ userId: id });
          success++;
        } catch {
          failed++;
        }
      }
    }

    if (success > 0) toast.success(`${success} user${success > 1 ? "s" : ""} updated`);
    if (failed > 0) toast.error(`${failed} failed`);

    setBulkAction(null);
    setBulkBanReason("");
    setBulkRole("user");
    setSelected(new Set());
    fetchUsers();
  }

  function exportUsers() {
    const headers = ["Name", "Email", "Role", "Status", "Created"];
    const rows = users.map((u) => [
      u.name,
      u.email,
      u.role ?? "user",
      u.banned ? "Banned" : "Active",
      new Date(u.createdAt).toISOString().slice(0, 10),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported current page to CSV");
  }

  const selectedUsers = useMemo(
    () => users.filter((u) => selected.has(u.id)),
    [users, selected]
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
      <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total} user{total !== 1 ? "s" : ""} &middot; manage roles, access & more
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-sm h-9 gap-1.5"
          onClick={exportUsers}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
            placeholder="Search by email or name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            className="pl-8 h-9 text-xs"
            />
          </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select
            value={filterRole}
            onValueChange={(v) => {
              setFilterRole(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 text-sm w-28">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Roles</SelectItem>
              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
              <SelectItem value="user" className="text-xs">User</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterStatus}
            onValueChange={(v) => {
              setFilterStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 text-sm w-28">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Status</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="banned" className="text-xs">Banned</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setFilterRole("all");
                setFilterStatus("all");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-xl">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="h-3 w-px bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setBulkAction("role")}
          >
            <Shield className="h-3.5 w-3.5" /> Set Role
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setBulkAction("ban")}
          >
            <Ban className="h-3.5 w-3.5" /> Ban
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setBulkAction("unban")}
          >
            <UserCheck className="h-3.5 w-3.5" /> Unban
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-destructive hover:text-destructive"
            onClick={() => setBulkAction("remove")}
          >
            <UserX className="h-3.5 w-3.5" /> Remove
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
          <div className="border border-border overflow-hidden rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected && users.length > 0}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold hover:text-foreground transition-colors"
                  onClick={() => handleSort("name")}
                >
                  User
                  <ArrowUpDown className="h-2.5 w-2.5" />
                </button>
                  </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold hover:text-foreground transition-colors"
                  onClick={() => handleSort("role")}
                >
                  Role
                  <ArrowUpDown className="h-2.5 w-2.5" />
                </button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    Status
                  </TableHead>
              <TableHead>
                <button
                  className="flex items-center gap-1 text-xs font-semibold hover:text-foreground transition-colors"
                  onClick={() => handleSort("createdAt")}
                >
                  Joined
                  <ArrowUpDown className="h-2.5 w-2.5" />
                </button>
              </TableHead>
                  <TableHead className="text-xs font-semibold text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-2 w-32" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                        <TableCell><Skeleton className="h-3 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-7 w-7 ml-auto" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : users.length === 0 ? (
                  <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <p className="text-xs text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelected={selected.has(u.id)}
                  onToggleSelect={() => toggleSelect(u.id)}
                  onEdit={() => {
                              setEditUser(u);
                              setEditName(u.name);
                              setEditEmail(u.email);
                              setEditPassword("");
                            }}
                  onRole={() => {
                    setRoleTarget(u);
                                setSelectedRole(u.role ?? "user");
                  }}
                  onBan={() => {
                    setBanTarget(u);
                    setBanReason("");
                    setBanExpiry("");
                  }}
                  onUnban={() => handleUnban(u.id)}
                  onRemove={() => setRemoveTarget(u)}
                />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

      {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} &middot; {total} total
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Edit User</DialogTitle>
            <DialogDescription className="text-sm">
              Update details for {editUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs font-semibold text-muted-foreground">
                Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs font-semibold text-muted-foreground">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-password" className="text-xs font-semibold text-muted-foreground">
                New Password
              </Label>
              <Input
                id="edit-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Change Role</DialogTitle>
            <DialogDescription className="text-sm">
              Set the role for {roleTarget?.name} ({roleTarget?.email})
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user" className="text-xs">User</SelectItem>
              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setRoleTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={() => roleTarget && handleSetRole(roleTarget.id, selectedRole)}
            >
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Ban User</DialogTitle>
            <DialogDescription className="text-sm">
              Ban {banTarget?.name} ({banTarget?.email}). They will be signed out immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Reason
              </Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for ban (optional)"
                className="min-h-[60px] text-xs resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Expires (optional)
              </Label>
              <Input
                type="datetime-local"
                value={banExpiry}
                onChange={(e) => setBanExpiry(e.target.value)}
                className="h-9 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for permanent ban
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setBanTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={() => banTarget && handleBan(banTarget.id, banReason, banExpiry || undefined)}
            >
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Permanently delete <strong>{removeTarget?.name}</strong> ({removeTarget?.email}) and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeTarget && handleRemove(removeTarget.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Dialogs */}
      <AlertDialog open={bulkAction === "ban"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {selected.size} User{selected.size > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              The selected users will be signed out and unable to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs font-semibold text-muted-foreground">
              Reason (optional)
            </Label>
            <Textarea
              value={bulkBanReason}
              onChange={(e) => setBulkBanReason(e.target.value)}
              placeholder="Reason for ban..."
              className="min-h-[60px] text-xs resize-none mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkAction}>
              Ban {selected.size} User{selected.size > 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction === "unban"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unban {selected.size} User{selected.size > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              The selected users will be able to sign in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkAction}>
              Unban {selected.size} User{selected.size > 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction === "role"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set Role for {selected.size} User{selected.size > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Change the role for all selected users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={bulkRole} onValueChange={setBulkRole}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user" className="text-xs">User</SelectItem>
                <SelectItem value="admin" className="text-xs">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkAction}>
              Set Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkAction === "remove"} onOpenChange={(open) => !open && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selected.size} User{selected.size > 1 ? "s" : ""}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Permanently delete {selected.size} user{selected.size > 1 ? "s" : ""} and all their data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedUsers.length <= 10 && (
            <div className="py-1 space-y-1">
              {selectedUsers.map((u) => (
                <p key={u.id} className="text-sm text-muted-foreground">
                  {u.name} ({u.email})
                </p>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkAction}>
              Remove {selected.size} User{selected.size > 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserRow({
  user,
  isSelected,
  onToggleSelect,
  onEdit,
  onRole,
  onBan,
  onUnban,
  onRemove,
}: {
  user: User;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onRole: () => void;
  onBan: () => void;
  onUnban: () => void;
  onRemove: () => void;
}) {
  return (
    <TableRow className={isSelected ? "bg-muted" : ""}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select ${user.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.image ?? ""} />
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {user.name?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
              {user.emailVerified && (
                <CheckCircle className="h-2.5 w-2.5 text-foreground/40 shrink-0" />
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={user.role === "admin" ? "default" : "secondary"}
          className="text-[11px]"
        >
          {user.role ?? "user"}
        </Badge>
      </TableCell>
      <TableCell>
        {user.banned ? (
          <div>
            <Badge variant="destructive" className="text-[11px]">Banned</Badge>
            {user.banReason && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[120px]">
                {user.banReason}
              </p>
            )}
          </div>
        ) : (
          <Badge variant="secondary" className="text-[11px]">Active</Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-2.5 w-2.5" />
          {new Date(user.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted cursor-pointer"
            >
              <MoreHorizontal className="h-4 w-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem className="text-xs gap-2" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs gap-2" onClick={onRole}>
              <Shield className="h-3.5 w-3.5" /> Change Role
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user.banned ? (
              <DropdownMenuItem className="text-xs gap-2" onClick={onUnban}>
                <UserCheck className="h-3.5 w-3.5" /> Unban
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="text-xs gap-2" onClick={onBan}>
                <Ban className="h-3.5 w-3.5" /> Ban User
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs gap-2 text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              <UserX className="h-3.5 w-3.5" /> Remove User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
