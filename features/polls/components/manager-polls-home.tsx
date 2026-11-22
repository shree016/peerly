"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Armchair, Eye, Plus, Users, Vote } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmptyAddCard } from "@/components/common/empty-add-card";

import { unwrap } from "@/lib/app-error";

import { listMyInvites, respondToInvite } from "../lib/collaborator-actions";
import { listManagedPolls } from "../lib/manage-actions";
import type { ManagerPollListItem, PollKind } from "../lib/types";
import {
  AudienceBadge,
  PrivateBadge,
  StatusBadge,
  closesInLabel,
} from "./poll-ui";

const TAB_COPY: Record<
  PollKind,
  { title: string; empty: string; cta: string }
> = {
  quick: {
    title: "Quick Polls",
    empty:
      "Ask a quick question — single or multiple choice, yes/no, or a short answer.",
    cta: "New Quick Poll",
  },
  seatlock: {
    title: "SeatLock",
    empty:
      "Let students lock a limited seat (electives, slots, teams) — first come, first served.",
    cta: "New SeatLock poll",
  },
};

export function ManagerPollsHome({
  initialTab,
  canEditRoster,
}: {
  initialTab: PollKind;
  canEditRoster: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<PollKind>(initialTab);

  return (
    <div className="mx-auto mt-6 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Polls
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage polls for your students.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/polls?view=student">
              <Eye className="size-4" /> Preview as student
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/polls/roster">
              <Users className="size-4" />{" "}
              {canEditRoster ? "Manage roster" : "View roster"}
            </Link>
          </Button>
        </div>
      </header>

      <PendingInvites />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = value as PollKind;
          setTab(next);
          router.replace(`/polls?tab=${next}`, { scroll: false });
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="quick">
              <Vote className="size-4" /> Quick Polls
            </TabsTrigger>
            <TabsTrigger value="seatlock">
              <Armchair className="size-4" /> SeatLock
            </TabsTrigger>
          </TabsList>
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/polls/new?kind=${tab}`}>
              <Plus className="size-4" /> {TAB_COPY[tab].cta}
            </Link>
          </Button>
        </div>
        {(["quick", "seatlock"] as const).map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-5">
            <PollGrid kind={kind} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PollGrid({ kind }: { kind: PollKind }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["polls", "managed", kind],
    queryFn: async () => unwrap(await listManagedPolls(kind)),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-[1.75rem]" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-destructive text-sm">{(error as Error).message}</p>
    );
  }
  if (!data || data.length === 0) {
    return (
      <EmptyAddCard
        title={`Create your first ${kind === "seatlock" ? "SeatLock poll" : "Quick Poll"}`}
        description={TAB_COPY[kind].empty}
        href={`/polls/new?kind=${kind}`}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((p) => (
        <ManagerPollCard key={p.id} poll={p} />
      ))}
    </div>
  );
}

function ManagerPollCard({ poll }: { poll: ManagerPollListItem }) {
  const closes = poll.status === "open" ? closesInLabel(poll.closesAt) : null;
  const fill =
    poll.totalSeats && poll.totalSeats > 0
      ? Math.round(((poll.seatsTaken ?? 0) / poll.totalSeats) * 100)
      : 0;
  return (
    <Link
      href={`/polls/${poll.id}`}
      className="peeerly-press peeerly-card flex flex-col gap-3 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={poll.status} />
        <AudienceBadge mode={poll.audienceMode} />
        {poll.manageMode === "private" && <PrivateBadge />}
      </div>
      <h3 className="line-clamp-2 font-serif text-lg leading-snug font-bold">
        {poll.title}
      </h3>
      {poll.kind === "seatlock" ? (
        <div>
          <div className="text-muted-foreground mb-1 flex justify-between text-xs">
            <span>
              {poll.seatsTaken ?? 0} / {poll.totalSeats ?? 0} seats locked
            </span>
            <span>{poll.optionCount} options</span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-sky h-full rounded-full"
              style={{ width: `${fill}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          {poll.responseCount} response{poll.responseCount === 1 ? "" : "s"}
        </p>
      )}
      <div className="text-muted-foreground mt-auto flex flex-wrap justify-between gap-2 text-xs">
        <span>
          {poll.isCreator
            ? "Created by you"
            : `By ${poll.creatorName ?? "a coordinator"}`}
        </span>
        {closes && (
          <span className="font-semibold text-orange-600 dark:text-orange-400">
            {closes}
          </span>
        )}
      </div>
    </Link>
  );
}

function PendingInvites() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["polls", "invites"],
    queryFn: async () => unwrap(await listMyInvites()),
  });
  const respond = useMutation({
    mutationFn: async (v: { inviteId: string; accept: boolean }) =>
      unwrap(await respondToInvite(v)),
    onSuccess: (result) => {
      toast.success(
        result.accepted ? "Invitation accepted" : "Invitation declined",
      );
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data || data.length === 0) return null;
  return (
    <section className="bg-sun-soft/60 rounded-[1.75rem] border p-4 sm:p-5">
      <h2 className="font-serif font-bold">Invitations to co-manage</h2>
      <ul className="mt-3 space-y-2">
        {data.map((invite) => (
          <li
            key={invite.id}
            className="bg-card flex flex-col gap-2 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {invite.pollTitle}
              </p>
              <p className="text-muted-foreground text-xs">
                {invite.pollKind === "seatlock" ? "SeatLock" : "Quick Poll"} ·
                invited by {invite.invitedByName ?? "a coordinator"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={respond.isPending}
                onClick={() =>
                  respond.mutate({ inviteId: invite.id, accept: true })
                }
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={respond.isPending}
                onClick={() =>
                  respond.mutate({ inviteId: invite.id, accept: false })
                }
              >
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
