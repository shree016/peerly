"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { unwrap } from "@/lib/app-error";
import { cn } from "@/lib/utils";

import { usePollChannel } from "../hooks/use-poll-channel";
import { getStudentPoll, submitPollResponse } from "../lib/student-actions";
import { SHORT_ANSWER_MAX, type StudentPollDTO } from "../lib/types";
import {
  ResultBars,
  StatusBadge,
  closesInLabel,
  formatDateTime,
} from "./poll-ui";

export function PollRespond({
  initial,
  isManager,
}: {
  initial: StudentPollDTO;
  isManager: boolean;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["polls", "student", initial.id];
  const { data: poll = initial } = useQuery({
    queryKey,
    queryFn: async () => unwrap(await getStudentPoll(initial.id)),
    initialData: initial,
    refetchInterval: initial.status === "open" ? 60_000 : false,
  });

  const [selected, setSelected] = useState<string[]>(
    poll.myResponse?.optionIds ?? [],
  );
  const [text, setText] = useState(poll.myResponse?.textAnswer ?? "");
  const [editing, setEditing] = useState(!poll.myResponse);

  // Live seat counts (counts only) and status changes.
  usePollChannel(poll.id, (event, payload) => {
    if (event === "seats" && Array.isArray(payload.options)) {
      const live = new Map(
        (
          payload.options as {
            id: string;
            seatsTaken: number;
            capacity: number | null;
          }[]
        ).map((o) => [o.id, o]),
      );
      queryClient.setQueryData<StudentPollDTO>(queryKey, (old) =>
        old
          ? {
              ...old,
              options: old.options.map((o) => {
                const update = live.get(o.id);
                return update && o.capacity !== null
                  ? {
                      ...o,
                      seatsTaken: update.seatsTaken,
                      capacity: update.capacity,
                    }
                  : o;
              }),
            }
          : old,
      );
    } else {
      queryClient.invalidateQueries({ queryKey });
    }
  });

  const submit = useMutation({
    mutationFn: async () =>
      unwrap(
        await submitPollResponse({
          pollId: poll.id,
          optionIds: poll.questionType === "short_answer" ? [] : selected,
          textAnswer: poll.questionType === "short_answer" ? text : null,
        }),
      ),
    onSuccess: () => {
      toast.success(
        poll.kind === "seatlock" ? "Seat locked!" : "Response saved",
      );
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const isSeatLock = poll.kind === "seatlock";
  const isMultiple = poll.questionType === "multiple";
  const isShort = poll.questionType === "short_answer";
  const closes = poll.status === "open" ? closesInLabel(poll.closesAt) : null;
  const showForm = poll.canRespond && editing;

  const toggle = (id: string) =>
    setSelected((list) =>
      isMultiple
        ? list.includes(id)
          ? list.filter((x) => x !== id)
          : [...list, id]
        : [id],
    );

  return (
    <div className="mx-auto mt-6 mb-12 max-w-2xl space-y-6 px-4 sm:mt-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={isManager ? "/polls?view=student" : "/polls"}>
          <ArrowLeft className="size-4" /> All polls
        </Link>
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={poll.status} />
          {poll.isAnonymous && (
            <span className="peeerly-chip bg-card border px-2.5 py-0.5 text-[0.7rem]">
              <Lock className="size-3" /> Anonymous
            </span>
          )}
          {poll.viaGrant && (
            <span className="peeerly-chip bg-sun-soft border px-2.5 py-0.5 text-[0.7rem]">
              Late access granted
            </span>
          )}
        </div>
        <h1 className="font-serif text-2xl leading-tight font-bold sm:text-3xl">
          {poll.title}
        </h1>
        {poll.description && (
          <p className="text-foreground/80 text-sm whitespace-pre-line sm:text-base">
            {poll.description}
          </p>
        )}
        <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {closes && (
            <span className="flex items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
              <Clock className="size-3.5" /> {closes}
            </span>
          )}
          {poll.closesAt && (
            <span>Deadline: {formatDateTime(poll.closesAt)}</span>
          )}
          {isSeatLock && (
            <span>One seat per student · first come, first served</span>
          )}
          {isMultiple && <span>Pick all that apply</span>}
        </p>
      </header>

      {poll.myResponse && !showForm && (
        <section className="bg-mint-soft/60 flex items-start gap-3 rounded-[1.5rem] border p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {isSeatLock ? "Your seat is locked" : "Your response is in"}
            </p>
            <p className="text-sm break-words">
              {isShort
                ? poll.myResponse.textAnswer
                : poll.options
                    .filter((o) => poll.myResponse!.optionIds.includes(o.id))
                    .map((o) => o.label)
                    .join(", ")}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatDateTime(poll.myResponse.submittedAt)}
            </p>
          </div>
          {poll.canRespond && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              Change
            </Button>
          )}
        </section>
      )}

      {!poll.myResponse && !poll.canRespond && (
        <p className="bg-card text-muted-foreground rounded-[1.5rem] border p-4 text-sm">
          {poll.blockedReason ?? "This poll isn't accepting responses."} You
          didn&apos;t respond.
        </p>
      )}

      {showForm && (
        <form
          className="peeerly-card space-y-4 p-4 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          {isShort ? (
            <div className="space-y-1.5">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={SHORT_ANSWER_MAX}
                rows={3}
                placeholder="Type your answer"
                aria-label="Your answer"
              />
              <p className="text-muted-foreground text-right text-xs tabular-nums">
                {text.length}/{SHORT_ANSWER_MAX}
              </p>
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="sr-only">Options</legend>
              {poll.options.map((o) => {
                const left =
                  o.capacity !== null
                    ? Math.max(0, o.capacity - o.seatsTaken)
                    : null;
                const full = left === 0 && !selected.includes(o.id);
                const checked = selected.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                      checked
                        ? "border-sky bg-sky-soft/60"
                        : "hover:bg-muted/60",
                      full && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type={isMultiple ? "checkbox" : "radio"}
                      name="poll-option"
                      className="accent-sky mt-1 size-4 shrink-0"
                      checked={checked}
                      disabled={full}
                      onChange={() => toggle(o.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{o.label}</span>
                      {o.description && (
                        <span className="text-muted-foreground block text-xs">
                          {o.description}
                        </span>
                      )}
                    </span>
                    {left !== null && (
                      <span
                        className={cn(
                          "shrink-0 text-xs font-semibold tabular-nums",
                          left === 0
                            ? "text-destructive"
                            : left <= 5
                              ? "text-orange-600"
                              : "text-muted-foreground",
                        )}
                      >
                        {left === 0 ? "Full" : `${left} left`}
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
          )}

          {isSeatLock && (
            <p className="text-muted-foreground text-xs">
              Locking a seat is final — you can&apos;t switch afterwards.
            </p>
          )}

          <div className="flex justify-end gap-2">
            {poll.myResponse && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                submit.isPending ||
                (isShort ? !text.trim() : selected.length === 0)
              }
            >
              {submit.isPending && <Spinner className="size-4" />}
              {isSeatLock
                ? "Lock my seat"
                : poll.myResponse
                  ? "Update answer"
                  : "Submit"}
            </Button>
          </div>
        </form>
      )}

      {poll.results && (
        <section className="peeerly-card p-4 sm:p-6">
          <h2 className="mb-4 font-serif text-lg font-bold">
            Results{" "}
            <span className="text-muted-foreground text-sm font-medium">
              ({poll.results.totalResponses} response
              {poll.results.totalResponses === 1 ? "" : "s"})
            </span>
          </h2>
          {isShort ? (
            <ul className="flex flex-wrap gap-2">
              {(poll.results.answers ?? []).slice(0, 100).map((a, i) => (
                <li
                  key={i}
                  className="bg-sky-soft/60 rounded-full border px-3 py-1 text-sm"
                >
                  {a}
                </li>
              ))}
            </ul>
          ) : (
            <ResultBars
              options={poll.results.options}
              total={poll.results.totalResponses}
              highlightIds={poll.myResponse?.optionIds}
            />
          )}
        </section>
      )}
    </div>
  );
}
