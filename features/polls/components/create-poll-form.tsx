"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { unwrap } from "@/lib/app-error";
import { cn } from "@/lib/utils";

import { createPoll } from "../lib/manage-actions";
import {
  type ManageMode,
  type PollKind,
  QUESTION_TYPE_LABELS,
  QUICK_QUESTION_TYPES,
  type QuestionType,
} from "../lib/types";
import { SectionCard, ToggleRow, fromLocalInput } from "./poll-ui";

interface DraftOption {
  key: string;
  label: string;
  description: string;
  capacity: string;
}

const newOption = (): DraftOption => ({
  key: crypto.randomUUID(),
  label: "",
  description: "",
  capacity: "",
});

export function CreatePollForm({ kind }: { kind: PollKind }) {
  const router = useRouter();
  const isSeatLock = kind === "seatlock";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("single");
  const [options, setOptions] = useState<DraftOption[]>([
    newOption(),
    newOption(),
  ]);
  const [closesAt, setClosesAt] = useState("");
  const [manageMode, setManageMode] = useState<ManageMode>("shared");
  const [showResults, setShowResults] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowVoteChange, setAllowVoteChange] = useState(true);

  const needsOptions =
    isSeatLock || questionType === "single" || questionType === "multiple";

  const create = useMutation({
    mutationFn: async () => {
      const filled = options.filter((o) => o.label.trim());
      return unwrap(
        await createPoll({
          kind,
          questionType: isSeatLock ? "single" : questionType,
          title,
          description: description || null,
          closesAt: fromLocalInput(closesAt),
          manageMode,
          showResults,
          isAnonymous: isSeatLock ? false : isAnonymous,
          allowVoteChange: isSeatLock ? false : allowVoteChange,
          options: needsOptions
            ? filled.map((o) => ({
                label: o.label,
                description: o.description || null,
                capacity: isSeatLock ? Number(o.capacity) || null : null,
              }))
            : [],
        }),
      );
    },
    onSuccess: ({ id }) => {
      toast.success("Poll created as a draft. Set the audience, then open it.");
      router.push(`/polls/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOption = (key: string, patch: Partial<DraftOption>) =>
    setOptions((list) =>
      list.map((o) => (o.key === key ? { ...o, ...patch } : o)),
    );

  return (
    <div className="mx-auto mt-6 mb-12 max-w-3xl space-y-6 px-4 sm:mt-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={`/polls?tab=${kind}`}>
          <ArrowLeft className="size-4" /> Polls
        </Link>
      </Button>
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          {isSeatLock ? "New SeatLock poll" : "New Quick Poll"}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isSeatLock
            ? "Each option has a fixed number of seats. Students lock one seat — once it's full, it's full."
            : "Ask a question and collect answers from your students."}
        </p>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <SectionCard title="Question">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  isSeatLock
                    ? "Choose your 3rd-semester elective"
                    : "Which day suits the workshop?"
                }
                maxLength={160}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Details (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>
            {!isSeatLock && (
              <div className="space-y-1.5">
                <Label>Answer type</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {QUICK_QUESTION_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setQuestionType(t)}
                      className={cn(
                        "rounded-2xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                        questionType === t
                          ? "bg-sky-soft border-sky"
                          : "hover:bg-muted",
                      )}
                    >
                      {QUESTION_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {needsOptions && (
          <SectionCard
            title="Options"
            description={
              isSeatLock ? "Give every option a seat count." : undefined
            }
          >
            <ul className="space-y-3">
              {options.map((o, i) => (
                <li key={o.key} className="rounded-2xl border p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground mt-2.5 w-5 text-sm tabular-nums">
                      {i + 1}.
                    </span>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_8rem]">
                      <Input
                        aria-label={`Option ${i + 1}`}
                        value={o.label}
                        onChange={(e) =>
                          updateOption(o.key, { label: e.target.value })
                        }
                        placeholder={
                          isSeatLock
                            ? "e.g. Cloud Computing"
                            : `Option ${i + 1}`
                        }
                        maxLength={120}
                      />
                      {isSeatLock && (
                        <Input
                          aria-label={`Seats for option ${i + 1}`}
                          type="number"
                          min={1}
                          max={10000}
                          value={o.capacity}
                          onChange={(e) =>
                            updateOption(o.key, { capacity: e.target.value })
                          }
                          placeholder="Seats"
                        />
                      )}
                      {isSeatLock && (
                        <Input
                          aria-label={`Description for option ${i + 1}`}
                          className="sm:col-span-2"
                          value={o.description}
                          onChange={(e) =>
                            updateOption(o.key, { description: e.target.value })
                          }
                          placeholder="Short description (optional)"
                          maxLength={300}
                        />
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove option ${i + 1}`}
                      disabled={options.length <= 1}
                      onClick={() =>
                        setOptions((list) =>
                          list.filter((x) => x.key !== o.key),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={options.length >= 50}
              onClick={() => setOptions((list) => [...list, newOption()])}
            >
              <Plus className="size-4" /> Add option
            </Button>
          </SectionCard>
        )}

        <SectionCard title="Settings" description="You can change these later.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="closesAt">Closes at (optional)</Label>
              <Input
                id="closesAt"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                The poll closes itself at this time — no late responses get in.
              </p>
            </div>
            <ToggleRow
              label="Show results to students"
              description="Students see the counts after they respond or once the poll closes."
              checked={showResults}
              onChange={setShowResults}
            />
            {!isSeatLock && (
              <>
                <ToggleRow
                  label="Anonymous"
                  description="Managers see answers but never who gave them. Can't be changed after the first response."
                  checked={isAnonymous}
                  onChange={setIsAnonymous}
                />
                <ToggleRow
                  label="Allow changing the answer"
                  description="Students can update their answer while the poll is open."
                  checked={allowVoteChange}
                  onChange={setAllowVoteChange}
                />
              </>
            )}
            <ToggleRow
              label="Only me (and people I invite)"
              description="Off: every coordinator and faculty member can manage this poll."
              checked={manageMode === "private"}
              onChange={(v) => setManageMode(v ? "private" : "shared")}
            />
          </div>
        </SectionCard>

        <div className="flex justify-end gap-2">
          <Button asChild type="button" variant="outline">
            <Link href={`/polls?tab=${kind}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Spinner className="size-4" />}
            Create draft
          </Button>
        </div>
      </form>
    </div>
  );
}
