import Link from "next/link";
import { redirect } from "next/navigation";

import { ArrowUpRight, BriefcaseBusiness, Gamepad2, Sparkles } from "lucide-react";

import { CtaPill } from "@/components/common/cta-pill";

import { getExperienceStats } from "@/features/experiences/lib/actions";
import { HeroIllustration } from "@/features/landing/components/hero-illustration";
import { QuickJoin } from "@/features/quiz/components/quick-join";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

async function safeStats() {
  try {
    return await getExperienceStats();
  } catch {
    return null;
  }
}

const steps = [
  {
    emoji: "🎯",
    title: "Join with a code",
    body: "Your coordinator starts a live quiz — punch in the 6-character code, pick an avatar, and you're in.",
    tone: "bg-sky-soft",
  },
  {
    emoji: "⚡",
    title: "Answer fast, climb faster",
    body: "Speed and accuracy both score. Watch the leaderboard reshuffle after every question.",
    tone: "bg-sun-soft",
  },
  {
    emoji: "📚",
    title: "Prep with real stories",
    body: "Read round-by-round placement experiences from seniors, with JDs and prep resources attached.",
    tone: "bg-candy-soft",
  },
];

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  const stats = await safeStats();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="grid items-center gap-8 pt-6 sm:pt-10 md:grid-cols-2 md:gap-12 md:pt-16">
        <HeroIllustration className="order-1 w-full md:order-2" />

        <div className="order-2 flex flex-col items-center text-center md:order-1 md:items-start md:text-left">
          <span className="peeerly-chip bg-sun-soft text-foreground mb-4 border border-sun/50">
            <Sparkles className="size-3.5" /> Built by students, for students
          </span>
          <h1 className="text-4xl leading-[1.08] font-bold sm:text-5xl lg:text-6xl">
            Play smart quizzes.
            <br />
            <span className="text-primary">Crack placements</span> together.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-md text-base sm:text-lg">
            Peeerly brings your class&apos;s live quizzes and your seniors&apos;
            placement experiences into one friendly place.
          </p>

          <div className="mt-8 flex w-full flex-col items-center gap-4 md:items-start">
            <CtaPill href="/auth/signup" label="Get Started" />
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── Quick join ───────────────────────────────────────────────── */}
      <section className="peeerly-card mt-12 flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:justify-between sm:p-6 sm:text-left">
        <div>
          <h2 className="text-lg font-bold sm:text-xl">Got a quiz code?</h2>
          <p className="text-muted-foreground text-sm">
            No account needed to play — just jump in.
          </p>
        </div>
        <QuickJoin />
      </section>

      {/* ── Feature cards ────────────────────────────────────────────── */}
      <section className="mt-16">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="text-2xl font-bold sm:text-3xl">What&apos;s inside</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/quiz/join"
            className="peeerly-press group relative overflow-hidden rounded-[2rem] bg-linear-to-br from-sky to-primary p-6 text-white shadow-lg sm:p-8"
          >
            <span className="peeerly-chip bg-white/25 backdrop-blur">
              <Gamepad2 className="size-3.5" /> Live Quiz
            </span>
            <h3 className="mt-4 max-w-[14rem] text-3xl leading-tight font-bold">
              Rise up the{" "}
              <span className="bg-sun rounded-lg px-1.5 text-black">leaderboard</span>
            </h3>
            <p className="mt-3 max-w-xs text-sm text-white/85">
              Real-time quizzes with avatars, streaks, podium finishes and a
              personal performance report after every game.
            </p>
            <span className="absolute -right-2 -bottom-4 text-[7rem] drop-shadow-2xl transition-transform duration-500 group-hover:-rotate-6 sm:text-[9rem]">
              🏆
            </span>
            <span className="bg-ink text-ink-foreground mt-6 flex size-12 items-center justify-center rounded-full">
              <ArrowUpRight className="size-5" />
            </span>
          </Link>

          <Link
            href="/experiences"
            className="peeerly-press group bg-candy-soft relative overflow-hidden rounded-[2rem] p-6 shadow-lg sm:p-8"
          >
            <span className="peeerly-chip bg-white/70 dark:bg-white/10">
              <BriefcaseBusiness className="size-3.5" /> Placements
            </span>
            <h3 className="mt-4 max-w-[15rem] text-3xl leading-tight font-bold">
              Learn from seniors who made it
            </h3>
            <p className="text-foreground/75 mt-3 max-w-xs text-sm">
              Every round — aptitude, OA, coding, GD, interviews — with a
              cleared-or-not flag, JDs and prep resources.
            </p>
            <span className="absolute -right-2 -bottom-4 text-[7rem] drop-shadow-2xl transition-transform duration-500 group-hover:rotate-6 sm:text-[9rem]">
              🧑‍💻
            </span>
            <span className="bg-ink text-ink-foreground mt-6 flex size-12 items-center justify-center rounded-full">
              <ArrowUpRight className="size-5" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Live numbers ─────────────────────────────────────────────── */}
      {stats && stats.experienceCount > 0 && (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Experiences", value: stats.experienceCount, emoji: "📝" },
            { label: "Companies", value: stats.companyCount, emoji: "🏢" },
            { label: "Rounds", value: stats.roundCount, emoji: "🧩" },
            { label: "Resources", value: stats.resourceCount, emoji: "📎" },
          ].map((tile) => (
            <div key={tile.label} className="peeerly-card p-4">
              <span className="text-2xl">{tile.emoji}</span>
              <p className="mt-1 font-serif text-2xl font-bold">{tile.value}</p>
              <p className="text-muted-foreground text-xs font-medium">{tile.label}</p>
            </div>
          ))}
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="mb-5 text-2xl font-bold sm:text-3xl">How Peeerly works</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="peeerly-card p-6">
              <div className="flex items-center gap-3">
                <span
                  className={`${step.tone} flex size-12 items-center justify-center rounded-2xl text-2xl`}
                >
                  {step.emoji}
                </span>
                <span className="text-muted-foreground font-serif text-sm font-bold">
                  Step {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="bg-ink text-ink-foreground mt-16 flex flex-col items-center gap-5 rounded-[2rem] px-6 py-10 text-center sm:py-14">
        <span className="text-5xl">🚀</span>
        <h2 className="max-w-lg text-3xl font-bold sm:text-4xl">
          Play smart. Prep smarter. Every day.
        </h2>
        <CtaPill
          href="/auth/signup"
          label="Create your account"
          className="bg-card text-foreground"
        />
      </section>
    </div>
  );
}
