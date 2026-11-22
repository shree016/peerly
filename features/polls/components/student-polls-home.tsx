"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { unwrap } from "@/lib/app-error";

import { listMyPolls } from "../lib/student-actions";
import type { StudentPollDTO } from "../lib/types";
import { StatusBadge, closesInLabel } from "./poll-ui";

export function StudentPollsHome({ isManager }: { isManager: boolean }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["polls", "mine"],
    queryFn: async () => unwrap(await listMyPolls()),
    refetchInterval: 60_000,
  });

  return (
    <div className="mx-auto mt-6 mb-12 max-w-3xl space-y-8 px-4 sm:mt-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Polls
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Polls from your coordinators and faculty.
          </p>
        </div>
        {isManager && (
          <Button asChild variant="outline" size="sm">
            <Link href="/polls">
              <ArrowLeft className="size-4" /> Back to managing polls
            </Link>
          </Button>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[1.75rem]" />
          ))}
        </div>
      ) : error ? (
        <p className="text-destructive text-sm">{(error as Error).message}</p>
      ) : (
        <>
          <PollSection
            title="Open"
            polls={data?.open ?? []}
            empty="No open polls right now. You'll see a badge on Polls when one opens for you."
          />
          <PollSection
            title="Closed"
            polls={data?.closed ?? []}
            empty="Polls you could take part in appear here once they close."
          />
        </>
      )}
    </div>
  );
}

function PollSection({
  title,
  polls,
  empty,
}: {
  title: string;
  polls: StudentPollDTO[];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">
        {title}{" "}
        <span className="text-muted-foreground text-sm font-medium">
          ({polls.length})
        </span>
      </h2>
      {polls.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-[1.5rem] border p-5 text-sm">
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {polls.map((p) => (
            <li key={p.id}>
              <StudentPollCard poll={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StudentPollCard({ poll }: { poll: StudentPollDTO }) {
  const closes = poll.status === "open" ? closesInLabel(poll.closesAt) : null;
  const answered = !!poll.myResponse;
  const mineLabel = poll.myResponse
    ? poll.options
        .filter((o) => poll.myResponse!.optionIds.includes(o.id))
        .map((o) => o.label)
        .join(", ")
    : "";
  const seatsLeft =
    poll.kind === "seatlock" && poll.status === "open"
      ? poll.options.reduce(
          (sum, o) =>
            sum +
            (o.capacity !== null ? Math.max(0, o.capacity - o.seatsTaken) : 0),
          0,
        )
      : null;

  return (
    <Link
      href={`/polls/${poll.id}`}
      className="peeerly-press peeerly-card flex items-center gap-4 p-4 sm:p-5"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={poll.status} />
          {poll.viaGrant && (
            <span className="peeerly-chip bg-sun-soft border px-2.5 py-0.5 text-[0.7rem]">
              Late access granted
            </span>
          )}
        </div>
        <h3 className="truncate font-serif text-base font-bold sm:text-lg">
          {poll.title}
        </h3>
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {answered ? (
            <span className="text-foreground flex items-center gap-1 font-semibold">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              {poll.kind === "seatlock"
                ? `Your seat: ${mineLabel}`
                : mineLabel
                  ? `You voted: ${mineLabel}`
                  : "Answered"}
            </span>
          ) : poll.status === "closed" && !poll.canRespond ? (
            <span>You didn&apos;t respond</span>
          ) : (
            <span className="text-foreground font-semibold">
              Waiting for your response
            </span>
          )}
          {seatsLeft !== null && <span>{seatsLeft} seats left</span>}
          {closes && (
            <span className="flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
              <Clock className="size-3.5" /> {closes}
            </span>
          )}
        </p>
      </div>
      <ChevronRight className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}
