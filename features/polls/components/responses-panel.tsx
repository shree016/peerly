"use client";

import { useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ConfirmActionDialog } from "@/features/quiz/components/confirm-action-dialog";

import { unwrap } from "@/lib/app-error";

import {
  exportResponsesCsv,
  listNonResponders,
  listResponses,
} from "../lib/manage-actions";
import type { ManagerPollDTO } from "../lib/types";
import { SectionCard, downloadCsv, formatDateTime } from "./poll-ui";

export function ResponsesPanel({ poll }: { poll: ManagerPollDTO }) {
  const [confirmExport, setConfirmExport] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["polls", "responses", poll.id],
    queryFn: async () => unwrap(await listResponses(poll.id)),
  });

  const exportCsv = useMutation({
    mutationFn: async () => unwrap(await exportResponsesCsv(poll.id)),
    onSuccess: ({ filename, csv }) => {
      downloadCsv(filename, csv);
      setConfirmExport(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const anonymous = data?.anonymous ?? poll.isAnonymous;
  const isShort = poll.questionType === "short_answer";

  return (
    <div className="space-y-5">
      <SectionCard
        title={`Responses (${data?.rows.length ?? poll.responseCount})`}
        description={
          anonymous
            ? "Anonymous poll — who answered what is never shown or exported."
            : undefined
        }
        action={
          poll.canExport ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!data || data.rows.length === 0}
              onClick={() => setConfirmExport(true)}
            >
              <Download className="size-4" /> Export CSV
            </Button>
          ) : null
        }
      >
        {isLoading ? (
          <Spinner className="size-5" />
        ) : !data || data.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No responses yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {!anonymous && (
                    <>
                      <TableHead>Student</TableHead>
                      <TableHead>USN</TableHead>
                      <TableHead>Batch</TableHead>
                    </>
                  )}
                  <TableHead>
                    {isShort
                      ? "Answer"
                      : poll.kind === "seatlock"
                        ? "Seat"
                        : "Choice"}
                  </TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    {!anonymous && (
                      <>
                        <TableCell className="font-medium">
                          {r.name}
                          {r.viaGrant && (
                            <span className="peeerly-chip bg-sun-soft ml-2 border px-2 py-0 text-[0.65rem]">
                              late
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.usn ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.batch
                            ? `${r.batch}${r.section ? ` · ${r.section}` : ""}`
                            : "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="max-w-xs whitespace-normal">
                      {isShort ? r.textAnswer : r.choices.join(", ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateTime(r.submittedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {poll.status !== "draft" && <NonResponders poll={poll} />}

      <ConfirmActionDialog
        open={confirmExport}
        onOpenChange={setConfirmExport}
        title="Export responses?"
        description={
          anonymous
            ? "The file contains answers only — no names or USNs. The export is recorded in the audit log."
            : "This file contains students' personal data (names, USNs). Keep it private, don't share it publicly, and delete it when you're done. The export is recorded in the audit log."
        }
        confirmLabel="Download CSV"
        loading={exportCsv.isPending}
        onConfirm={() => exportCsv.mutate()}
      />
    </div>
  );
}

function NonResponders({ poll }: { poll: ManagerPollDTO }) {
  const [show, setShow] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["polls", "responses", poll.id, "non-responders"],
    queryFn: async () => unwrap(await listNonResponders(poll.id)),
    enabled: show,
  });

  return (
    <SectionCard
      title="Haven't responded"
      description="Roster students in the audience without a response."
      action={
        <Button size="sm" variant="outline" onClick={() => setShow((s) => !s)}>
          {show ? "Hide" : "Show list"}
        </Button>
      }
    >
      {!show ? null : isLoading ? (
        <Spinner className="size-5" />
      ) : !data || data.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Everyone in the audience has responded. 🎉
        </p>
      ) : (
        <>
          <p className="text-muted-foreground mb-3 flex items-center gap-1.5 text-xs">
            <ShieldAlert className="size-3.5" /> {data.length} student
            {data.length === 1 ? "" : "s"}. Personal data — for follow-up only.
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {data.map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-2 rounded-xl border px-3 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold tabular-nums">{s.usn}</span> ·{" "}
                  {s.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {s.batch} · {s.section}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
