"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { unwrap } from "@/lib/app-error";

import { updatePoll } from "../lib/manage-actions";
import type { ManagerPollDTO } from "../lib/types";
import {
  SectionCard,
  ToggleRow,
  fromLocalInput,
  toLocalInput,
} from "./poll-ui";

export function SettingsPanel({ poll }: { poll: ManagerPollDTO }) {
  const queryClient = useQueryClient();
  // The parent remounts this panel (via `settingsKey`) when the saved settings
  // change elsewhere — not on refetches caused by new responses, which would
  // wipe what's being typed.
  const [form, setForm] = useState(() => fromPoll(poll));

  const isSeatLock = poll.kind === "seatlock";
  const anonymityLocked = poll.responseCount > 0;

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await updatePoll({
          pollId: poll.id,
          title: form.title,
          description: form.description || null,
          closesAt: fromLocalInput(form.closesAt),
          showResults: form.showResults,
          ...(isSeatLock
            ? {}
            : {
                allowVoteChange: form.allowVoteChange,
                ...(anonymityLocked ? {} : { isAnonymous: form.isAnonymous }),
              }),
          ...(poll.canAdminister ? { manageMode: form.manageMode } : {}),
        }),
      ),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <SectionCard title="Details & settings">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="poll-title">Title</Label>
          <Input
            id="poll-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={160}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poll-description">Details</Label>
          <Textarea
            id="poll-description"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={1000}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="poll-closes">Closes at</Label>
          <div className="flex gap-2">
            <Input
              id="poll-closes"
              type="datetime-local"
              value={form.closesAt}
              onChange={(e) => set("closesAt", e.target.value)}
            />
            {form.closesAt && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => set("closesAt", "")}
              >
                Clear
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Enforced — the poll closes itself at this time.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow
            label="Show results to students"
            description="After they respond, or once the poll closes."
            checked={form.showResults}
            onChange={(v) => set("showResults", v)}
          />
          {!isSeatLock && (
            <ToggleRow
              label="Allow changing the answer"
              description="While the poll is open."
              checked={form.allowVoteChange}
              onChange={(v) => set("allowVoteChange", v)}
            />
          )}
          {!isSeatLock && (
            <ToggleRow
              label="Anonymous"
              description={
                anonymityLocked
                  ? "Locked — people already responded under the current setting."
                  : "Managers never see who answered what."
              }
              checked={form.isAnonymous}
              disabled={anonymityLocked}
              onChange={(v) => set("isAnonymous", v)}
            />
          )}
          <ToggleRow
            label="Only me (and people I invite)"
            description={
              poll.canAdminister
                ? "Off: every coordinator and faculty member can manage it."
                : "Only the creator can change this."
            }
            checked={form.manageMode === "private"}
            disabled={!poll.canAdminister}
            onChange={(v) => set("manageMode", v ? "private" : "shared")}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Spinner className="size-4" />}
            Save settings
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

export function settingsKey(poll: ManagerPollDTO): string {
  return JSON.stringify(fromPoll(poll));
}

function fromPoll(poll: ManagerPollDTO) {
  return {
    title: poll.title,
    description: poll.description ?? "",
    closesAt: toLocalInput(poll.closesAt),
    showResults: poll.showResults,
    allowVoteChange: poll.allowVoteChange,
    isAnonymous: poll.isAnonymous,
    manageMode: poll.manageMode,
  };
}
