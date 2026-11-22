"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { unwrap } from "@/lib/app-error";
import { cn } from "@/lib/utils";

import {
  grantLateAccess,
  listGrants,
  revokeLateAccess,
  searchGrantCandidates,
} from "../lib/grant-actions";
import type { ManagerPollDTO, StudentLite } from "../lib/types";
import { SectionCard, formatDateTime } from "./poll-ui";
import { StudentPicker } from "./student-picker";

export function GrantsPanel({ poll }: { poll: ManagerPollDTO }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const key = ["polls", "grants", poll.id];

  const { data: grants = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await listGrants(poll.id)),
    enabled: poll.status !== "draft",
  });

  const revoke = useMutation({
    mutationFn: async (grantId: string) =>
      unwrap(await revokeLateAccess({ pollId: poll.id, grantId })),
    onSuccess: () => {
      toast.success("Late access revoked");
      queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Late access"
      description="Let specific roster students respond after the poll closed, or even if they're outside the audience. Each grant is kept in history."
      action={
        poll.status !== "draft" ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <KeyRound className="size-4" /> Grant access
          </Button>
        ) : null
      }
    >
      {poll.status === "draft" ? (
        <p className="text-muted-foreground text-sm">Open the poll first.</p>
      ) : isLoading ? (
        <Spinner className="size-5" />
      ) : grants.length === 0 ? (
        <p className="text-muted-foreground text-sm">No late access granted.</p>
      ) : (
        <ul className="space-y-2">
          {grants.map((g) => {
            const state = g.revokedAt ? "Revoked" : g.used ? "Used" : "Active";
            return (
              <li
                key={g.id}
                className={cn(
                  "flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                  g.revokedAt && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="font-semibold tabular-nums">
                      {g.student.usn}
                    </span>{" "}
                    · {g.student.name}
                    <span className="peeerly-chip bg-card ml-2 border px-2 py-0 text-[0.65rem]">
                      {state}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs break-words">
                    “{g.remarks}” — {g.grantedByName ?? "a manager"},{" "}
                    {formatDateTime(g.grantedAt)}
                  </p>
                </div>
                {!g.revokedAt && !g.used && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(g.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <GrantDialog poll={poll} open={open} onOpenChange={setOpen} />
    </SectionCard>
  );
}

function GrantDialog({
  poll,
  open,
  onOpenChange,
}: {
  poll: ManagerPollDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [remarks, setRemarks] = useState("");

  const grant = useMutation({
    mutationFn: async () =>
      unwrap(
        await grantLateAccess({
          pollId: poll.id,
          studentIds: students.map((s) => s.id),
          remarks,
        }),
      ),
    onSuccess: ({ granted }) => {
      toast.success(
        `Late access granted to ${granted} student${granted === 1 ? "" : "s"}`,
      );
      setStudents([]);
      setRemarks("");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["polls", "grants", poll.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant late access</DialogTitle>
          <DialogDescription>
            Only students who haven&apos;t responded can be picked. Each can
            submit once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Students</Label>
            <StudentPicker
              value={students}
              onChange={setStudents}
              search={async (q) =>
                unwrap(
                  await searchGrantCandidates({ pollId: poll.id, query: q }),
                )
              }
              queryKeyPrefix={`grant-${poll.id}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grant-remarks">Reason</Label>
            <Textarea
              id="grant-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Was on medical leave during the poll"
              maxLength={300}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              grant.isPending ||
              students.length === 0 ||
              remarks.trim().length < 3
            }
            onClick={() => grant.mutate()}
          >
            {grant.isPending && <Spinner className="size-4" />}
            Grant access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
