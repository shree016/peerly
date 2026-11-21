import Link from "next/link";

import { ArrowUpRight, ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Podium, RankRow } from "@/components/common/podium";

import { CompanyAvatar } from "@/features/experiences/components/company-avatar";
import { getAllExperiences } from "@/features/experiences/lib/actions";
import type { ExperienceListItem } from "@/features/experiences/lib/types";
import { QuickJoin } from "@/features/quiz/components/quick-join";
import { canManageQuiz } from "@/features/quiz/lib/auth";

import { getUser } from "@/actions/user";

import { resolveProfileImageSrc } from "@/lib/s3/profile-image";

export const dynamic = "force-dynamic";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface CompanyRank {
  name: string;
  logoUrl: string | null;
  count: number;
  selected: number;
}

function rankCompanies(experiences: ExperienceListItem[]): CompanyRank[] {
  const byName = new Map<string, CompanyRank>();
  for (const exp of experiences) {
    const key = exp.companyName.trim().toLowerCase();
    const entry = byName.get(key) ?? {
      name: exp.companyName.trim(),
      logoUrl: null,
      count: 0,
      selected: 0,
    };
    entry.count += 1;
    if (exp.result === "Selected") entry.selected += 1;
    entry.logoUrl ??= exp.companyLogoUrl;
    byName.set(key, entry);
  }
  return [...byName.values()].sort(
    (a, b) => b.count - a.count || b.selected - a.selected || a.name.localeCompare(b.name),
  );
}

export default async function DashboardPage() {
  const user = (await getUser())!; // layout guarantees a signed-in user
  const isQuizAdmin = canManageQuiz(user.email);

  let experiences: ExperienceListItem[] = [];
  try {
    experiences = await getAllExperiences();
  } catch {
    experiences = [];
  }

  const myShared = experiences.filter((e) => e.authorId === user.id).length;
  const companies = rankCompanies(experiences);
  const latest = experiences[0];
  const recent = experiences.slice(1, 4);

  const firstName = user.name?.split(" ")[0] ?? "there";
  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || user.email[0].toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-8">
      {/* ── Greeting header ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="border-sky-soft size-12 border-4 shadow-sm sm:size-14">
            <AvatarImage
              src={resolveProfileImageSrc(user.image, user.updatedAt)}
              alt=""
            />
            <AvatarFallback className="bg-sky-soft font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium sm:text-sm">
              {greeting()} 👋
            </p>
            <h1 className="truncate text-xl font-bold sm:text-2xl">{firstName}</h1>
            <span className="peeerly-chip bg-card mt-0.5 border px-2.5 py-0.5 text-[0.7rem]">
              {isQuizAdmin ? "Quiz coordinator" : user.isCoordinator ? "Coordinator" : "Student"}
            </span>
          </div>
        </div>
        <Link
          href="/experiences/new"
          title="Experiences you've shared"
          className="peeerly-chip bg-card shrink-0 border px-3 py-2 text-sm shadow-sm"
        >
          <span className="bg-sun flex size-6 items-center justify-center rounded-full text-xs">
            💎
          </span>
          {myShared}
        </Link>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* ── Hero: join a quiz ──────────────────────────────────────── */}
          <section className="relative overflow-hidden rounded-[2rem] border-2 border-white/80 bg-linear-to-br from-sky-soft to-sky p-5 shadow-lg sm:p-7 dark:border-white/5">
            <div className="relative z-10 max-w-[70%] sm:max-w-[60%]">
              <h2 className="text-2xl leading-tight font-bold text-black sm:text-3xl dark:text-white">
                Rise up, quiz{" "}
                <span className="bg-sun rounded-lg px-1.5 text-black">champion</span>
              </h2>
              <p className="mt-2 text-sm text-black/70 dark:text-white/80">
                Climb ranks, sharpen minds — enter the code on the presenter&apos;s screen.
              </p>
            </div>
            <span className="animate-float absolute top-3 right-3 text-7xl drop-shadow-xl sm:right-8 sm:text-8xl">
              🏆
            </span>
            <QuickJoin className="relative z-10 mt-5 max-w-md" />
          </section>

          {/* ── Coordinator / share card (the "Upgrade pro" slot) ─────── */}
          {isQuizAdmin ? (
            <Link
              href="/quiz"
              className="peeerly-press bg-sky-soft/60 flex items-center gap-4 rounded-[1.75rem] border p-4 shadow-sm"
            >
              <span className="text-4xl">👑</span>
              <div className="min-w-0 flex-1">
                <p className="font-serif font-bold">Manage quizzes</p>
                <p className="text-muted-foreground text-xs">
                  Create events, run live sessions, view analytics.
                </p>
              </div>
              <span className="bg-card flex size-11 shrink-0 items-center justify-center rounded-full border">
                <ArrowUpRight className="size-5" />
              </span>
            </Link>
          ) : (
            <Link
              href="/experiences/new"
              className="peeerly-press bg-sky-soft/60 flex items-center gap-4 rounded-[1.75rem] border p-4 shadow-sm"
            >
              <span className="text-4xl">✍️</span>
              <div className="min-w-0 flex-1">
                <p className="font-serif font-bold">Share your experience</p>
                <p className="text-muted-foreground text-xs">
                  Help juniors crack the same drive you did.
                </p>
              </div>
              <span className="bg-card flex size-11 shrink-0 items-center justify-center rounded-full border">
                <ArrowUpRight className="size-5" />
              </span>
            </Link>
          )}

          {/* ── Latest experience (the pink "Popular game" card) ──────── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Latest placement story</h2>
              <Link
                href="/experiences"
                className="text-muted-foreground hover:text-foreground flex items-center text-sm font-semibold"
              >
                See all <ChevronRight className="size-4" />
              </Link>
            </div>

            {latest ? (
              <Link
                href={`/experiences/${latest.id}`}
                className="peeerly-press bg-candy-soft relative block overflow-hidden rounded-[2rem] p-5 shadow-lg sm:p-6"
              >
                <span className="peeerly-chip bg-white/80 dark:bg-white/10">{latest.batch}</span>
                <h3 className="mt-3 max-w-[70%] text-2xl leading-tight font-bold">
                  {latest.companyName}
                </h3>
                <p className="text-foreground/75 mt-1 max-w-[65%] text-sm">
                  {latest.role} · {latest.roundCount} rounds · {latest.result}
                </p>
                <p className="text-foreground/70 mt-3 line-clamp-2 max-w-[70%] text-sm">
                  {latest.overview}
                </p>
                <CompanyAvatar
                  companyName={latest.companyName}
                  logoUrl={latest.companyLogoUrl}
                  size="size-24 sm:size-28 rounded-[1.75rem] text-4xl"
                  className="absolute top-5 right-5 rotate-6 shadow-xl"
                />
                <span className="bg-ink text-ink-foreground mt-5 flex size-12 items-center justify-center rounded-full">
                  <ArrowUpRight className="size-5" />
                </span>
              </Link>
            ) : (
              <Link
                href="/experiences/new"
                className="bg-candy-soft block rounded-[2rem] p-6 text-center shadow-sm"
              >
                <span className="text-5xl">📝</span>
                <p className="mt-2 font-serif font-bold">No stories yet</p>
                <p className="text-muted-foreground text-sm">Be the first to share one.</p>
              </Link>
            )}

            {recent.length > 0 && (
              <div className="mt-3 space-y-2">
                {recent.map((exp) => (
                  <Link key={exp.id} href={`/experiences/${exp.id}`} className="peeerly-press block">
                    <RankRow
                      rank={experiences.indexOf(exp) + 1}
                      avatar={
                        <CompanyAvatar
                          companyName={exp.companyName}
                          logoUrl={exp.companyLogoUrl}
                          size="size-11 rounded-full text-base"
                        />
                      }
                      name={exp.companyName}
                      subtitle={`${exp.role} · ${exp.batch}`}
                      trailing={
                        <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                      }
                    />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Companies leaderboard (podium) ───────────────────────────── */}
        <aside className="peeerly-card peeerly-rays h-fit overflow-hidden p-4 sm:p-6">
          <div className="mb-6 text-center">
            <span className="peeerly-chip bg-sun text-black">All batches</span>
            <h2 className="bg-sky-soft mx-auto mt-2 w-fit rounded-full border px-6 py-2 text-lg font-bold shadow-sm">
              Top companies
            </h2>
          </div>

          {companies.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Company rankings appear once experiences are shared.
            </p>
          ) : (
            <>
              <Podium
                entries={companies.slice(0, 3).map((c) => ({
                  id: c.name,
                  name: c.name,
                  avatar: (
                    <CompanyAvatar
                      companyName={c.name}
                      logoUrl={c.logoUrl}
                      size="size-full text-2xl"
                    />
                  ),
                  value: <>📝 {c.count}</>,
                }))}
              />
              <div className="bg-sky-soft/40 -mx-1 space-y-2 rounded-3xl p-2">
                {companies.slice(3, 6).map((c, i) => (
                  <Link
                    key={c.name}
                    href={`/experiences?q=${encodeURIComponent(c.name)}`}
                    className="block"
                  >
                    <RankRow
                      rank={i + 4}
                      avatar={
                        <CompanyAvatar
                          companyName={c.name}
                          logoUrl={c.logoUrl}
                          size="size-11 rounded-full text-base"
                        />
                      }
                      name={c.name}
                      value={<>📝 {c.count}</>}
                      trailing={
                        <span
                          className={
                            c.selected > 0
                              ? "size-0 border-x-[7px] border-b-[10px] border-x-transparent border-b-emerald-500"
                              : "size-0 border-x-[7px] border-t-[10px] border-x-transparent border-t-orange-500"
                          }
                          title={c.selected > 0 ? `${c.selected} selected` : "No selections yet"}
                        />
                      }
                    />
                  </Link>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
