"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { unwrap } from "@/lib/app-error";

import {
  inviteCollaborators,
  listCollaborators,
  listInviteCandidates,
  removeCollaborator,
} from "../lib/collaborator-actions";
import type { ManagerPollDTO } from "../lib/types";
import { SectionCard } from "./poll-ui";

const STATUS_LABEL = {
  pending: "Invited",
  accepted: "Co-manager",
  declined: "Declined",
} as const;

export function CollaboratorsPanel({ poll }: { poll: ManagerPollDTO }) {
  const queryClient = useQueryClient();
  const key = ["polls", "collaborators", poll.id];
  const isPrivate = poll.manageMode === "private";
  const [selected, setSelected] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await listCollaborators(poll.id)),
    enabled: isPrivate,
  });
  const { data: candidates = [] } = useQuery({
    queryKey: [...key, "candidates"],
    queryFn: async () => unwrap(await listInviteCandidates(poll.id)),
    enabled: isPrivate && poll.canAdminister,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  const invite = useMutation({
    mutationFn: async () =>
      unwrap(
        await inviteCollaborators({ pollId: poll.id, userIds: [selected] }),
      ),
    onSuccess: () => {
      toast.success("Invitation sent");
      setSelected("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (collaboratorId: string) =>
      unwrap(await removeCollaborator({ pollId: poll.id, collaboratorId })),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isPrivate) {
    return (
      <SectionCard title="Who can manage">
        <p className="text-muted-foreground text-sm">
          Shared — every faculty member and coordinator can manage this poll.
          Turn on <strong>Only me</strong> in Setup to restrict it and invite
          specific people.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Who can manage"
      description={`Private — ${poll.creatorName ?? "the creator"}, admins, and the people below once they accept.`}
    >
      {poll.canAdminister && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  candidates.length
                    ? "Choose a coordinator or faculty member"
                    : "No one else to invite"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name ?? c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!selected || invite.isPending}
            onClick={() => invite.mutate()}
          >
            {invite.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Invite
          </Button>
        </div>
      )}
      {isLoading ? (
        <Spinner className="size-5" />
      ) : !data || data.collaborators.length === 0 ? (
        <p className="text-muted-foreground text-sm">No collaborators yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.collaborators.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-2xl border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {c.name ?? c.email}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {c.email}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="peeerly-chip bg-card border px-2.5 py-0.5 text-[0.7rem]">
                  {STATUS_LABEL[c.status]}
                </span>
                {data.canAdminister && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remove collaborator"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c.id)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
