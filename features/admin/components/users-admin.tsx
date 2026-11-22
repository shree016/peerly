"use client";

import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, LogOut, Search, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { ConfirmActionDialog } from "@/features/quiz/components/confirm-action-dialog";

import { unwrap } from "@/lib/app-error";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_NAMES,
  type RoleName,
} from "@/lib/permissions/roles";
import { resolveProfileImageSrc } from "@/lib/s3/profile-image";
import { cn } from "@/lib/utils";

import {
  type AdminUserRow,
  banUser,
  listUsersForAdmin,
  revokeUserSessions,
  setUserRoles,
  unbanUser,
} from "../lib/actions";

const ASSIGNABLE: RoleName[] = ROLE_NAMES.filter((r) => r !== "student");

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState<RoleName | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [banning, setBanning] = useState<AdminUserRow | null>(null);
  const [revoking, setRevoking] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", debounced, role, page],
    queryFn: async () =>
      unwrap(
        await listUsersForAdmin({ query: debounced || undefined, role, page }),
      ),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["access"] });
  };

  const unban = useMutation({
    mutationFn: async (userId: string) => unwrap(await unbanUser(userId)),
    onSuccess: () => {
      toast.success("Account reactivated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revoke = useMutation({
    mutationFn: async (userId: string) =>
      unwrap(await revokeUserSessions(userId)),
    onSuccess: () => {
      toast.success("Signed out of all devices");
      setRevoking(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[undefined, ...ROLE_NAMES].map((r) => (
            <button
              key={r ?? "all"}
              type="button"
              onClick={() => {
                setRole(r);
                setPage(1);
              }}
              className={cn(
                "peeerly-chip border px-3 py-1.5 text-xs",
                role === r ? "bg-sky-soft border-sky" : "bg-card",
              )}
            >
              {r ? ROLE_LABELS[r] : "Everyone"}
            </button>
          ))}
        </div>
      </div>

      <section className="peeerly-card divide-y overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <Spinner className="size-5" />
          </div>
        ) : !data || data.users.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">No users found.</p>
        ) : (
          data.users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 p-4 md:flex-row md:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar className="size-10 shrink-0">
                  <AvatarImage
                    src={resolveProfileImageSrc(u.image, null)}
                    alt=""
                  />
                  <AvatarFallback>
                    {(u.name ?? u.email)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {u.name ?? "Unnamed"}
                    {u.id === currentUserId && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {u.email}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {u.isOwner && (
                  <span className="peeerly-chip bg-sun border px-2.5 py-0.5 text-[0.7rem] text-black">
                    <ShieldCheck className="size-3" /> Owner
                  </span>
                )}
                {u.roles.map((r) => (
                  <span
                    key={r}
                    className="peeerly-chip bg-sky-soft border px-2.5 py-0.5 text-[0.7rem]"
                  >
                    {ROLE_LABELS[r]}
                  </span>
                ))}
                {u.banned && (
                  <span className="peeerly-chip bg-destructive border px-2.5 py-0.5 text-[0.7rem] text-white">
                    Suspended
                  </span>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(u)}
                >
                  <UserCog className="size-4" /> Roles
                </Button>
                {u.id !== currentUserId &&
                  !u.isOwner &&
                  (u.banned ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={unban.isPending}
                      onClick={() => unban.mutate(u.id)}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Suspend"
                      title="Suspend"
                      onClick={() => setBanning(u)}
                    >
                      <Ban className="size-4" />
                    </Button>
                  ))}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Sign out everywhere"
                  title="Sign out of all devices"
                  onClick={() => setRevoking(u)}
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <RolesDialog
        key={editing?.id ?? "none"}
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={invalidate}
      />
      <BanDialog
        user={banning}
        onClose={() => setBanning(null)}
        onDone={invalidate}
      />
      <ConfirmActionDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Sign out of all devices?"
        description={`${revoking?.name ?? revoking?.email ?? "This user"} will have to sign in again everywhere.`}
        confirmLabel="Sign out everywhere"
        loading={revoke.isPending}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking.id);
        }}
      />
    </div>
  );
}

function RolesDialog({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Mounted fresh per user (keyed by the parent), so no effect is needed.
  const [selected, setSelected] = useState<RoleName[]>(
    () => user?.storedRoles.filter((r) => r !== "student") ?? [],
  );

  const save = useMutation({
    mutationFn: async () =>
      unwrap(await setUserRoles({ userId: user!.id, roles: selected })),
    onSuccess: () => {
      toast.success("Roles updated");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Roles for {user?.name ?? user?.email}</DialogTitle>
          <DialogDescription>
            Everyone is a student by default. Add roles to grant more access — a
            person can hold several.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {ASSIGNABLE.map((r) => {
            const ownerAdmin = r === "admin" && user?.isOwner;
            const checked = ownerAdmin || selected.includes(r);
            return (
              <li key={r}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3",
                    checked && "border-sky bg-sky-soft/50",
                    ownerAdmin && "cursor-not-allowed",
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-sky mt-1 size-4"
                    checked={checked}
                    disabled={ownerAdmin}
                    onChange={(e) =>
                      setSelected((list) =>
                        e.target.checked
                          ? [...list, r]
                          : list.filter((x) => x !== r),
                      )
                    }
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {ROLE_LABELS[r]}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {ownerAdmin
                        ? "Owner account — always admin (set in the server's environment)."
                        : ROLE_DESCRIPTIONS[r]}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {selected.includes("admin") && !user?.storedRoles.includes("admin") && (
          <p className="bg-sun-soft/60 rounded-2xl border p-3 text-xs">
            Admins can see all student data and change anyone&apos;s access.
            Only give this to people you fully trust.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Spinner className="size-4" />}
            Save roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({
  user,
  onClose,
  onDone,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const ban = useMutation({
    mutationFn: async () => unwrap(await banUser({ userId: user!.id, reason })),
    onSuccess: () => {
      toast.success("Account suspended");
      setReason("");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Suspend {user?.name ?? user?.email}?</DialogTitle>
          <DialogDescription>
            They&apos;ll be signed out everywhere and can&apos;t sign in until
            reactivated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="ban-reason">Reason (kept in the audit trail)</Label>
          <Textarea
            id="ban-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={ban.isPending || reason.trim().length < 3}
            onClick={() => ban.mutate()}
          >
            {ban.isPending && <Spinner className="size-4" />}
            Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
