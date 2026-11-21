import { BriefcaseBusiness, PenLine } from "lucide-react";

import { CtaPill } from "@/components/common/cta-pill";

import { CoordinatorSetup } from "@/features/experiences/components/coordinator-setup";
import { ExperienceBrowser } from "@/features/experiences/components/experience-browser";
import { ExperienceShowcase } from "@/features/experiences/components/experience-showcase";
import {
  getAllExperiences,
  getExperienceStats,
} from "@/features/experiences/lib/actions";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Placement Experiences" };

const tileTones = [
  "bg-sky-soft",
  "bg-sun-soft",
  "bg-candy-soft",
  "bg-mint-soft",
  "bg-sky-soft",
];

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, experiences, stats, currentUser] = await Promise.all([
    searchParams,
    getAllExperiences(),
    getExperienceStats(),
    getUser(),
  ]);

  const statTiles = [
    { value: stats.experienceCount, label: "Experiences", emoji: "📝" },
    { value: stats.companyCount, label: "Companies", emoji: "🏢" },
    { value: stats.roundCount, label: "Rounds", emoji: "🧩" },
    { value: stats.resourceCount, label: "Resources", emoji: "📎" },
    { value: stats.commentCount, label: "Questions", emoji: "💬" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="bg-candy-soft relative mt-4 overflow-hidden rounded-[2rem] p-6 shadow-lg sm:mt-8 sm:p-10">
        <span className="peeerly-chip bg-white/80 dark:bg-white/10">
          <BriefcaseBusiness className="size-3.5" /> Community knowledge base
        </span>
        <h1 className="mt-4 max-w-2xl text-3xl leading-[1.08] font-bold sm:text-5xl">
          Placement experiences, shared by your seniors.
        </h1>
        <p className="text-foreground/75 mt-3 max-w-xl text-sm sm:text-lg">
          Every stage — aptitude, OA, coding, GD and interviews — with a clear
          cleared-or-not flag on each round, plus the JD and prep resources.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <CtaPill
            href="/experiences/new"
            label="Share your experience"
            icon={PenLine}
          />
          {currentUser && !currentUser.isCoordinator && (
            <CoordinatorSetup prominent />
          )}
        </div>
        <span
          aria-hidden
          className="animate-float pointer-events-none absolute -right-4 -bottom-6 hidden text-[9rem] drop-shadow-2xl md:block"
        >
          🧑‍💻
        </span>
      </section>

      <div className="scrollbar-hide -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {statTiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`${tileTones[i]} min-w-[8.5rem] shrink-0 rounded-3xl border p-4 sm:min-w-0 sm:p-3 lg:p-4`}
          >
            <span className="text-xl">{tile.emoji}</span>
            <div className="font-serif text-2xl font-bold">{tile.value}</div>
            <div className="text-muted-foreground text-xs font-medium">
              {tile.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 mb-16">
        <ExperienceBrowser experiences={experiences} initialSearch={q ?? ""} />
      </div>

      <div className="mb-16">
        <ExperienceShowcase />
      </div>
    </div>
  );
}
