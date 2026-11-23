import { eq, sql } from "drizzle-orm";

import {
  DAILY_SECONDS_PER_USER,
  DEFAULT_DAILY_SECONDS_SITE,
  istDay,
} from "@/features/experiences/lib/voice/options";

import db from "@/db";
import { voiceUsage } from "@/db/schema";

export type VoiceReservation =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; reason: "user_limit" | "site_limit" };

function siteDailySeconds() {
  const minutes = Number(process.env.VOICE_DAILY_SITE_MINUTES);
  return Number.isFinite(minutes) && minutes > 0
    ? Math.floor(minutes * 60)
    : DEFAULT_DAILY_SECONDS_SITE;
}

/**
 * Adds `seconds` to a counter only if that keeps it within `cap`. One upsert,
 * so two requests at the same moment can't both slip under the limit.
 */
async function add(key: string, seconds: number, cap: number) {
  const rows = await db
    .insert(voiceUsage)
    .values({ key, seconds })
    .onConflictDoUpdate({
      target: voiceUsage.key,
      set: {
        seconds: sql`${voiceUsage.seconds} + ${seconds}`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`${voiceUsage.seconds} + ${seconds} <= ${cap}`,
    })
    .returning({ seconds: voiceUsage.seconds });
  return rows.length > 0;
}

async function subtract(key: string, seconds: number) {
  await db
    .update(voiceUsage)
    .set({ seconds: sql`greatest(${voiceUsage.seconds} - ${seconds}, 0)` })
    .where(eq(voiceUsage.key, key));
}

/**
 * Books one piece of audio against the student's and the site's daily limit
 * before it is sent to Sarvam. If the conversion then fails, `release` gives
 * the seconds back, so a Sarvam outage never eats a student's allowance.
 */
export async function reserveVoiceSeconds(
  userId: string,
  durationSeconds: number,
): Promise<VoiceReservation> {
  const seconds = Math.max(1, Math.ceil(durationSeconds));
  const day = istDay();
  const userKey = `user:${userId}:${day}`;
  const siteKey = `site:${day}`;

  if (!(await add(userKey, seconds, DAILY_SECONDS_PER_USER))) {
    return { ok: false, reason: "user_limit" };
  }
  if (!(await add(siteKey, seconds, siteDailySeconds()))) {
    await subtract(userKey, seconds);
    return { ok: false, reason: "site_limit" };
  }

  return {
    ok: true,
    release: async () => {
      await Promise.all([
        subtract(userKey, seconds),
        subtract(siteKey, seconds),
      ]);
    },
  };
}
