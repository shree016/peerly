"use client";

import { useEffect, useRef } from "react";

import { Podium, RankRow } from "@/components/common/podium";

import { QuizAvatar } from "@/features/quiz/components/quiz-avatar";

export interface QuizLeaderboardEntry {
  rank: number;
  participantId: string;
  displayName: string;
  avatar: string;
  totalScore: number;
  scoreDelta: number;
}

interface QuizFinalLeaderboardProps {
  entries: QuizLeaderboardEntry[];
  /** Highlight this participant in the ranked list below the podium */
  highlightParticipantId?: string | null;
  className?: string;
}

export function QuizFinalLeaderboard({
  entries,
  highlightParticipantId = null,
  className = "",
}: QuizFinalLeaderboardProps) {
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    import("canvas-confetti").then((mod) => {
      const confetti = mod.default;
      const end = Date.now() + 5000;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    });
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div
      className={`peeerly-rays mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:px-6 ${className}`}
    >
      <div className="text-center">
        <span className="peeerly-chip bg-sun text-black">Final results</span>
        <h2 className="bg-sky-soft mx-auto mt-2 w-fit rounded-full border px-8 py-2.5 text-xl font-bold shadow-sm sm:text-2xl">
          Leaderboard
        </h2>
      </div>

      <Podium
        entries={top3.map((entry) => ({
          id: entry.participantId,
          name: entry.displayName,
          avatar: <QuizAvatar emoji={entry.avatar} size="3xl" />,
          value: <>⭐ {entry.totalScore.toLocaleString()}</>,
          highlight: highlightParticipantId === entry.participantId,
        }))}
      />

      {rest.length > 0 && (
        <div className="bg-sky-soft/40 -mt-2 space-y-2 rounded-3xl p-2 sm:p-3">
          {rest.map((entry) => {
            const isMe = highlightParticipantId === entry.participantId;
            return (
              <RankRow
                key={entry.participantId}
                rank={entry.rank}
                avatar={<QuizAvatar emoji={entry.avatar} size="xl" />}
                name={`${entry.displayName}${isMe ? " (you)" : ""}`}
                value={<>⭐ {entry.totalScore.toLocaleString()}</>}
                highlight={isMe}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
