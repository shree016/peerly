"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { unwrap } from "@/lib/app-error";
import { cn } from "@/lib/utils";

import { setAudience } from "../lib/manage-actions";
import { listRosterGroups, searchRosterStudents } from "../lib/roster-actions";
import type { AudienceMode, ManagerPollDTO, StudentLite } from "../lib/types";
import { SectionCard } from "./poll-ui";
import { StudentPicker } from "./student-picker";

const ALL_SECTIONS = "__all__";

const MODES: { value: AudienceMode; title: string; description: string }[] = [
  {
    value: "all",
    title: "Everyone",
    description: "Any signed-in Peeerly user.",
  },
  {
    value: "group",
    title: "A batch",
    description: "One batch, optionally one section.",
  },
  {
    value: "custom",
    title: "Selected students",
    description: "Pick students from the roster.",
  },
];

export function AudienceEditor({
  poll,
  canWriteRoster,
}: {
  poll: ManagerPollDTO;
  canWriteRoster: boolean;
}) {
  const queryClient = useQueryClient();
  const closed = poll.status === "closed";

  const [mode, setMode] = useState<AudienceMode>(poll.audience.mode);
  const [batch, setBatch] = useState(poll.audience.rule?.batch ?? "");
  const [section, setSection] = useState(
    poll.audience.rule?.section ?? ALL_SECTIONS,
  );
  const [members, setMembers] = useState<StudentLite[]>(
    poll.audience.members ?? [],
  );
  const [exclusions, setExclusions] = useState<StudentLite[]>(
    poll.audience.exclusions ?? [],
  );

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["roster", "groups"],
    queryFn: async () => unwrap(await listRosterGroups()),
  });
  const batches = useMemo(
    () => [...new Set(groups.map((g) => g.batch))],
    [groups],
  );
  const sections = groups.filter((g) => g.batch === batch);
  const groupSize =
    section === ALL_SECTIONS
      ? sections.reduce((s, g) => s + g.count, 0)
      : (sections.find((g) => g.section === section)?.count ?? 0);

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await setAudience({
          pollId: poll.id,
          mode,
          batch: mode === "group" ? batch : null,
          section:
            mode === "group" && section !== ALL_SECTIONS ? section : null,
          studentIds: mode === "custom" ? members.map((m) => m.id) : [],
          excludedStudentIds:
            mode === "group" ? exclusions.map((m) => m.id) : [],
        }),
      ),
    onSuccess: () => {
      toast.success("Audience saved");
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const search = async (q: string) => unwrap(await searchRosterStudents(q));

  return (
    <SectionCard
      title="Audience"
      description={
        closed
          ? "The audience of a closed poll is fixed. Use late access (Access tab) for stragglers."
          : "Who can see and answer this poll. Students outside it never see the poll at all."
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              disabled={closed}
              onClick={() => setMode(m.value)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors disabled:opacity-60",
                mode === m.value ? "bg-sky-soft border-sky" : "hover:bg-muted",
              )}
            >
              <span className="block text-sm font-semibold">{m.title}</span>
              <span className="text-muted-foreground block text-xs">
                {m.description}
              </span>
            </button>
          ))}
        </div>

        {mode !== "all" && !groupsLoading && groups.length === 0 && (
          <p className="bg-sun-soft/60 rounded-2xl border p-3 text-sm">
            The roster is empty, so nobody can match this audience yet.{" "}
            {canWriteRoster ? (
              <Link href="/polls/roster" className="font-semibold underline">
                Import the roster
              </Link>
            ) : (
              "Ask faculty or a placement coordinator to import it."
            )}
          </p>
        )}

        {mode === "group" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Batch</Label>
                <Select
                  value={batch}
                  onValueChange={(v) => {
                    setBatch(v);
                    setSection(ALL_SECTIONS);
                  }}
                  disabled={closed}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select
                  value={section}
                  onValueChange={setSection}
                  disabled={closed || !batch}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_SECTIONS}>All sections</SelectItem>
                    {sections.map((g) => (
                      <SelectItem key={g.section} value={g.section}>
                        Section {g.section} ({g.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {batch && (
              <p className="text-muted-foreground text-xs">
                {groupSize - exclusions.length} of {groupSize} roster students
                will be included.
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Exclude specific students (optional)</Label>
              <StudentPicker
                value={exclusions}
                onChange={setExclusions}
                search={search}
                queryKeyPrefix="exclude"
              />
            </div>
          </div>
        )}

        {mode === "custom" && (
          <div className="space-y-1.5">
            <Label>Students ({members.length})</Label>
            <StudentPicker
              value={members}
              onChange={setMembers}
              search={search}
              queryKeyPrefix="members"
            />
          </div>
        )}

        {!closed && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Spinner className="size-4" />}
              Save audience
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
