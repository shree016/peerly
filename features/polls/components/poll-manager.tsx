"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Eye,
  MonitorPlay,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ConfirmActionDialog } from "@/features/quiz/components/confirm-action-dialog";

import { unwrap } from "@/lib/app-error";

import { usePollChannel } from "../hooks/use-poll-channel";
import {
  deletePoll,
  getManagerPoll,
  getManagerResults,
  setPollStatus,
} from "../lib/manage-actions";
import { type ManagerPollDTO, QUESTION_TYPE_LABELS } from "../lib/types";
import { AudienceEditor } from "./audience-editor";
import { CollaboratorsPanel } from "./collaborators-panel";
import { GrantsPanel } from "./grants-panel";
import { OptionsEditor } from "./options-editor";
import {
  AudienceBadge,
  KindBadge,
  PrivateBadge,
  ResultBars,
  SectionCard,
  StatusBadge,
  closesInLabel,
  formatDateTime,
} from "./poll-ui";
import { ResponsesPanel } from "./responses-panel";
import { SettingsPanel, settingsKey } from "./settings-panel";

export function managerPollKey(id: string) {
  return ["polls", "manager", id] as const;
}

export function PollManager({
  initial,
  canWriteRoster,
}: {
  initial: ManagerPollDTO;
  canWriteRoster: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = managerPollKey(initial.id);
  const { data: poll = initial } = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await getManagerPoll(initial.id)),
    initialData: initial,
  });

  const [confirm, setConfirm] = useState<null | "open" | "close" | "delete">(
    null,
  );

  usePollChannel(poll.id, () => {
    queryClient.invalidateQueries({ queryKey: ["polls", "manager", poll.id] });
    queryClient.invalidateQueries({ queryKey: ["polls", "results", poll.id] });
    queryClient.invalidateQueries({
      queryKey: ["polls", "responses", poll.id],
    });
  });

  const status = useMutation({
    mutationFn: async (next: "open" | "closed") =>
      unwrap(await setPollStatus({ pollId: poll.id, status: next })),
    onSuccess: ({ status: next }) => {
      toast.success(next === "open" ? "Poll is open" : "Poll closed");
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirm(null);
    },
  });

  const remove = useMutation({
    mutationFn: async () => unwrap(await deletePoll(poll.id)),
    onSuccess: () => {
      toast.success("Poll deleted");
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      router.push(`/polls?tab=${poll.kind}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closes = poll.status === "open" ? closesInLabel(poll.closesAt) : null;

  return (
    <div className="mx-auto mt-6 mb-12 max-w-5xl space-y-6 px-4 sm:mt-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={`/polls?tab=${poll.kind}`}>
          <ArrowLeft className="size-4" /> Polls
        </Link>
      </Button>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={poll.status} />
            <KindBadge kind={poll.kind} />
            <AudienceBadge mode={poll.audience.mode} />
            {poll.manageMode === "private" && <PrivateBadge />}
          </div>
          <h1 className="font-serif text-2xl leading-tight font-bold sm:text-3xl">
            {poll.title}
          </h1>
          <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {poll.kind === "quick" && (
              <span>{QUESTION_TYPE_LABELS[poll.questionType]}</span>
            )}
            <span>
              {poll.responseCount} response{poll.responseCount === 1 ? "" : "s"}
            </span>
            {poll.closesAt && (
              <span>Closes {formatDateTime(poll.closesAt)}</span>
            )}
            {closes && (
              <span className="font-semibold text-orange-600">{closes}</span>
            )}
            <span>By {poll.creatorName ?? "a coordinator"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          {poll.status !== "open" ? (
            <Button
              onClick={() => setConfirm("open")}
              disabled={status.isPending}
            >
              <Play className="size-4" />{" "}
              {poll.status === "draft" ? "Open poll" : "Reopen"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirm("close")}
              disabled={status.isPending}
            >
              <Square className="size-4" /> Close poll
            </Button>
          )}
          {poll.questionType === "short_answer" && (
            <Button asChild variant="outline">
              <Link href={`/polls/${poll.id}/wall`} target="_blank">
                <MonitorPlay className="size-4" /> Live wall
              </Link>
            </Button>
          )}
          {poll.status !== "draft" && (
            <Button asChild variant="outline">
              <Link href={`/polls/${poll.id}?view=student`}>
                <Eye className="size-4" /> Student view
              </Link>
            </Button>
          )}
          {poll.canAdminister && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirm("delete")}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </header>

      {poll.status === "draft" && (
        <p className="bg-sun-soft/60 rounded-[1.25rem] border p-3 text-sm">
          This poll is a <strong>draft</strong> — students can&apos;t see it
          yet. Check the options and audience, then open it.
        </p>
      )}

      <Tabs defaultValue={poll.status === "draft" ? "setup" : "results"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-5 space-y-5">
          {/* Keys remount the forms only when their saved values change. */}
          <SettingsPanel key={settingsKey(poll)} poll={poll} />
          {poll.questionType !== "short_answer" && (
            <OptionsEditor poll={poll} />
          )}
          <AudienceEditor
            key={`${poll.status}:${JSON.stringify(poll.audience)}`}
            poll={poll}
            canWriteRoster={canWriteRoster}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-5">
          <ResultsPanel poll={poll} />
        </TabsContent>

        <TabsContent value="responses" className="mt-5">
          <ResponsesPanel poll={poll} />
        </TabsContent>

        <TabsContent value="access" className="mt-5 space-y-5">
          <GrantsPanel poll={poll} />
          <CollaboratorsPanel poll={poll} />
        </TabsContent>
      </Tabs>

      <ConfirmActionDialog
        open={confirm === "open" || confirm === "close"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "close" ? "Close this poll?" : "Open this poll?"}
        description={
          confirm === "close"
            ? "Students won't be able to respond any more. You can still give specific students late access."
            : "Students in the audience will see it and can respond right away."
        }
        confirmLabel={confirm === "close" ? "Close poll" : "Open poll"}
        loading={status.isPending}
        onConfirm={() => status.mutate(confirm === "close" ? "closed" : "open")}
      />
      <ConfirmActionDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this poll?"
        description={`This permanently deletes the poll and all ${poll.responseCount} response(s). This can't be undone.`}
        confirmLabel="Delete poll"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

function ResultsPanel({ poll }: { poll: ManagerPollDTO }) {
  const { data, isLoading } = useQuery({
    queryKey: ["polls", "results", poll.id],
    queryFn: async () => unwrap(await getManagerResults(poll.id)),
    refetchInterval: poll.status === "open" ? 15_000 : false,
  });

  return (
    <SectionCard
      title="Results"
      description={
        poll.showResults
          ? "Students can see these counts after responding or once the poll closes."
          : "Only managers can see these results."
      }
    >
      {isLoading || !data ? (
        <Spinner className="size-5" />
      ) : data.totalResponses === 0 ? (
        <p className="text-muted-foreground text-sm">No responses yet.</p>
      ) : poll.questionType === "short_answer" ? (
        <ul className="flex flex-wrap gap-2">
          {(data.answers ?? []).map((a, i) => (
            <li
              key={i}
              className="bg-sky-soft/60 rounded-full border px-3 py-1 text-sm"
            >
              {a}
            </li>
          ))}
        </ul>
      ) : (
        <ResultBars options={data.options} total={data.totalResponses} />
      )}
    </SectionCard>
  );
}
