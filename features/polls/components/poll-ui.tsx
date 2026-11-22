"use client";

import type { ReactNode } from "react";

import { Armchair, Lock, Users, Vote } from "lucide-react";

import { cn } from "@/lib/utils";

import type { AudienceMode, PollKind, PollStatus } from "../lib/types";

const STATUS_STYLES: Record<PollStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-mint-soft text-foreground",
  closed: "bg-candy-soft text-foreground",
};

const STATUS_LABELS: Record<PollStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

export function StatusBadge({ status }: { status: PollStatus }) {
  return (
    <span
      className={cn(
        "peeerly-chip border px-2.5 py-0.5 text-[0.7rem]",
        STATUS_STYLES[status],
      )}
    >
      {status === "open" && (
        <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function KindBadge({ kind }: { kind: PollKind }) {
  const Icon = kind === "seatlock" ? Armchair : Vote;
  return (
    <span className="peeerly-chip bg-sky-soft border px-2.5 py-0.5 text-[0.7rem]">
      <Icon className="size-3" aria-hidden />
      {kind === "seatlock" ? "SeatLock" : "Quick Poll"}
    </span>
  );
}

export function AudienceBadge({ mode }: { mode: AudienceMode }) {
  const label =
    mode === "all"
      ? "Everyone"
      : mode === "group"
        ? "Batch"
        : "Selected students";
  return (
    <span className="peeerly-chip bg-card border px-2.5 py-0.5 text-[0.7rem]">
      <Users className="size-3" aria-hidden />
      {label}
    </span>
  );
}

export function PrivateBadge() {
  return (
    <span className="peeerly-chip bg-sun-soft border px-2.5 py-0.5 text-[0.7rem]">
      <Lock className="size-3" aria-hidden />
      Private
    </span>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("peeerly-card p-4 sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-2xl border p-3",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description && (
          <span className="text-muted-foreground block text-xs">
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        className="accent-sky mt-1 size-4 shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

/** "Closes in 2h", "Closes in 3 days", or null. */
export function closesInLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `Closes in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Closes in ${hours}h`;
  return `Closes in ${Math.round(hours / 24)} days`;
}

/** ISO string → value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 names correctly.
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ResultBars({
  options,
  total,
  highlightIds = [],
}: {
  options: {
    id: string;
    label: string;
    count: number;
    capacity: number | null;
  }[];
  total: number;
  highlightIds?: string[];
}) {
  return (
    <ul className="space-y-3">
      {options.map((o) => {
        const base = o.capacity ?? total;
        const pct = base > 0 ? Math.round((o.count / base) * 100) : 0;
        const mine = highlightIds.includes(o.id);
        return (
          <li key={o.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className={cn("min-w-0 truncate", mine && "font-bold")}>
                {o.label}
                {mine && (
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    (you)
                  </span>
                )}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {o.capacity !== null
                  ? `${o.count} / ${o.capacity} seats`
                  : `${o.count} · ${pct}%`}
              </span>
            </div>
            <div className="bg-muted h-2.5 overflow-hidden rounded-full">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  mine ? "bg-sky" : "bg-sky/60",
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
