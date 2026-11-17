import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PodiumEntry {
  id: string;
  name: string;
  /** Avatar node (emoji image, company tile, profile picture…) */
  avatar: ReactNode;
  /** Score / count shown in the chip under the name */
  value: ReactNode;
  /** Marks the current viewer, e.g. "(you)" */
  highlight?: boolean;
}

// Visual order on screen is 2nd · 1st · 3rd, like a real podium.
const PLACES = [
  {
    index: 1,
    rank: 2,
    block: "h-24 sm:h-28 bg-sun-soft border-sun/60",
    top: "bg-sun",
    ring: "bg-sun-soft",
  },
  {
    index: 0,
    rank: 1,
    block: "h-32 sm:h-40 bg-mint-soft border-mint/60",
    top: "bg-mint",
    ring: "bg-mint-soft",
  },
  {
    index: 2,
    rank: 3,
    block: "h-16 sm:h-20 bg-candy-soft border-candy/60",
    top: "bg-candy",
    ring: "bg-candy-soft",
  },
] as const;

/**
 * Three-step podium in the Peeerly style (yellow · green · pink blocks with
 * floating avatars and pill-shaped score chips). Used by the live-quiz final
 * leaderboard and the dashboard's company leaderboard.
 */
export function Podium({
  entries,
  className,
}: {
  entries: PodiumEntry[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid w-full max-w-md grid-cols-3 items-end gap-2 sm:gap-3",
        className,
      )}
    >
      {PLACES.map((place) => {
        const entry = entries[place.index];
        if (!entry) return <div key={place.rank} />;
        const isFirst = place.rank === 1;

        return (
          <div key={entry.id} className="flex min-w-0 flex-col items-center">
            <div className="relative mb-1.5">
              <div
                className={cn(
                  "flex items-center justify-center overflow-hidden rounded-full border-4 border-white shadow-md dark:border-white/10",
                  place.ring,
                  isFirst ? "size-20 sm:size-24" : "size-16 sm:size-20",
                )}
              >
                {entry.avatar}
              </div>
              <span className="bg-sun text-foreground absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold shadow dark:border-white/10 dark:text-black">
                {place.rank}
              </span>
            </div>

            <p className="w-full truncate text-center text-sm font-bold">
              {entry.name}
              {entry.highlight ? " (you)" : ""}
            </p>
            <span className="peeerly-chip bg-card mt-1 mb-2 border shadow-xs">
              {entry.value}
            </span>

            <div
              className={cn(
                "relative w-full rounded-t-2xl border border-b-0",
                place.block,
              )}
            >
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-3 rounded-t-2xl opacity-70",
                  place.top,
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A "#4 · avatar · name · chip · trend" row that sits under the podium. */
export function RankRow({
  rank,
  avatar,
  name,
  subtitle,
  value,
  highlight,
  trailing,
}: {
  rank: number;
  avatar: ReactNode;
  name: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  highlight?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card flex items-center gap-3 rounded-2xl border px-3 py-2.5 shadow-xs sm:gap-4 sm:px-4",
        highlight && "border-primary ring-primary/40 ring-2",
      )}
    >
      <span className="text-muted-foreground w-8 shrink-0 text-center font-serif text-base font-bold">
        #{rank}
      </span>
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-soft">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold sm:text-base">{name}</p>
        {subtitle && (
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        )}
        {value && (
          <span className="peeerly-chip bg-muted mt-0.5 px-2 py-0.5">{value}</span>
        )}
      </div>
      {trailing}
    </div>
  );
}
