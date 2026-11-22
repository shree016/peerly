"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { unwrap } from "@/lib/app-error";

import { type AuditRow, listAuditLog } from "../lib/actions";

const ACTION_LABELS: Record<string, string> = {
  "role.update": "Changed roles",
  "user.ban": "Suspended account",
  "user.unban": "Reactivated account",
  "user.sessions.revoke": "Signed out everywhere",
  "roster.create": "Added roster student",
  "roster.update": "Edited roster student",
  "roster.delete": "Removed roster student",
  "roster.delete_batch": "Deleted roster batch",
  "roster.import": "Imported roster",
  "roster.export": "Exported roster",
  "poll.delete": "Deleted poll",
  "poll.export": "Exported poll responses",
  "poll.grant.create": "Granted late access",
  "poll.grant.revoke": "Revoked late access",
};

function describe(entry: AuditRow): string {
  const d = entry.details ?? {};
  if (
    entry.action === "role.update" &&
    Array.isArray(d.from) &&
    Array.isArray(d.to)
  ) {
    return `${(d.from as string[]).join(", ")} → ${(d.to as string[]).join(", ")}${d.source === "bootstrap" ? " (bootstrap script)" : ""}`;
  }
  const parts = Object.entries(d)
    .filter(
      ([, v]) =>
        typeof v === "number" ||
        typeof v === "boolean" ||
        typeof v === "string",
    )
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.join(" · ");
}

export function AuditLogView() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: async () => unwrap(await listAuditLog(page)),
  });
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="space-y-4">
      <section className="peeerly-card divide-y overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <Spinner className="size-5" />
          </div>
        ) : !data || data.entries.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            Nothing recorded yet.
          </p>
        ) : (
          data.entries.map((e) => (
            <div
              key={e.id}
              className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">
                    {e.actorName ?? e.actorEmail ?? "System"}
                  </span>{" "}
                  {(ACTION_LABELS[e.action] ?? e.action).toLowerCase()}
                  {e.targetLabel && (
                    <>
                      {" "}
                      for <span className="font-semibold">{e.targetLabel}</span>
                    </>
                  )}
                  {e.targetType === "roster" && e.targetId && (
                    <> ({e.targetId})</>
                  )}
                </p>
                {describe(e) && (
                  <p className="text-muted-foreground text-xs">{describe(e)}</p>
                )}
              </div>
              <time
                className="text-muted-foreground shrink-0 text-xs"
                dateTime={e.createdAt}
              >
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(e.createdAt))}
              </time>
            </div>
          ))
        )}
      </section>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Newer
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
