"use client";

import { useMemo } from "react";

import Link from "next/link";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { unwrap } from "@/lib/app-error";
import { cn } from "@/lib/utils";

import { usePollChannel } from "../hooks/use-poll-channel";
import { getManagerResults } from "../lib/manage-actions";

const COLORS = [
  "text-sky",
  "text-candy",
  "text-emerald-500",
  "text-orange-500",
  "text-violet-500",
  "text-cyan-500",
  "text-amber-500",
];

function sizeClass(count: number, max: number) {
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.8) return "text-6xl sm:text-8xl";
  if (ratio > 0.55) return "text-5xl sm:text-7xl";
  if (ratio > 0.35) return "text-4xl sm:text-5xl";
  if (ratio > 0.2) return "text-3xl sm:text-4xl";
  return "text-xl sm:text-2xl";
}

/** Full-screen word cloud for short-answer polls, for projecting in class. */
export function WordWall({ pollId, title }: { pollId: string; title: string }) {
  const queryClient = useQueryClient();
  const key = ["polls", "results", pollId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await getManagerResults(pollId)),
    refetchInterval: 10_000,
  });
  usePollChannel(pollId, () =>
    queryClient.invalidateQueries({ queryKey: key }),
  );

  const words = useMemo(() => {
    const map = new Map<string, { text: string; count: number }>();
    for (const answer of data?.answers ?? []) {
      const k = answer.trim().toLowerCase();
      if (!k) continue;
      const entry = map.get(k) ?? { text: answer.trim(), count: 0 };
      entry.count += 1;
      map.set(k, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 80);
  }, [data]);
  const max = words[0]?.count ?? 0;

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col overflow-hidden p-6 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold sm:text-4xl">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {data?.totalResponses ?? 0} responses · updates live
          </p>
        </div>
        <Link
          href={`/polls/${pollId}`}
          aria-label="Exit wall"
          className="hover:bg-muted rounded-full border p-2"
        >
          <X className="size-5" />
        </Link>
      </div>
      <div className="flex flex-1 flex-wrap content-center items-center justify-center gap-x-6 gap-y-3 overflow-hidden">
        {words.length === 0 ? (
          <p className="text-muted-foreground text-lg">Waiting for answers…</p>
        ) : (
          words.map((w, i) => (
            <span
              key={w.text}
              className={cn(
                "font-bold transition-all duration-500",
                sizeClass(w.count, max),
                COLORS[i % COLORS.length],
              )}
            >
              {w.text}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
