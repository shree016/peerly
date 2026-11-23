import { NextRequest, NextResponse } from "next/server";

import {
  buildKeyterms,
  isVoiceOutput,
  sarvamModeFor,
} from "@/features/experiences/lib/voice/options";
import {
  MAX_WAV_BYTES,
  readVoiceWav,
} from "@/features/experiences/lib/voice/wav";

import { rateLimit } from "@/lib/rate-limit";
import {
  SarvamError,
  isSarvamConfigured,
  transcribeWithSarvam,
} from "@/lib/sarvam";
import { reserveVoiceSeconds } from "@/lib/voice-usage";

import { getUser } from "@/actions/user";

// One piece is at most 29 s of audio; Sarvam answers well inside this.
export const maxDuration = 30;

/** Context words (company, role, stage) the client may send to help accuracy. */
const MAX_CONTEXT_TERMS = 6;

function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Voice typing: turns one piece (≤ 29 s) of a student's recording into text.
 * The audio is passed straight to Sarvam and never stored by Peeerly.
 */
export async function POST(request: NextRequest) {
  // getUser returns null for logged-out and unverified accounts alike.
  const currentUser = await getUser();
  if (!currentUser || currentUser.banned) {
    return fail(401, "UNAUTHORIZED", "Log in to use voice typing.");
  }

  if (!isSarvamConfigured()) {
    return fail(
      503,
      "NOT_CONFIGURED",
      "Voice typing isn't set up yet. Please type instead.",
    );
  }

  // Speed bump only (per server instance). The real limit is the daily one below.
  if (!rateLimit(`voice:${currentUser.id}`, 12, 60_000)) {
    return fail(
      429,
      "TOO_FAST",
      "Too many voice requests. Wait a minute and try again.",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "BAD_REQUEST", "Couldn't read the recording.");
  }

  const file = form.get("audio");
  const output = form.get("output");
  if (!(file instanceof Blob) || !isVoiceOutput(output)) {
    return fail(400, "BAD_REQUEST", "Couldn't read the recording.");
  }
  if (file.size > MAX_WAV_BYTES) {
    return fail(413, "TOO_LONG", "That piece of recording is too long.");
  }

  const audio = new Uint8Array(await file.arrayBuffer());
  const wav = readVoiceWav(audio);
  if (!wav) {
    return fail(400, "BAD_AUDIO", "Couldn't read the recording.");
  }

  const context = form
    .getAll("context")
    .filter((value): value is string => typeof value === "string")
    .slice(0, MAX_CONTEXT_TERMS);

  const reservation = await reserveVoiceSeconds(
    currentUser.id,
    wav.durationSeconds,
  );
  if (!reservation.ok) {
    return reservation.reason === "user_limit"
      ? fail(
          429,
          "DAILY_LIMIT",
          "You've used today's 30 minutes of voice typing. Please type the rest, or try again tomorrow.",
        )
      : fail(
          429,
          "SITE_LIMIT",
          "Voice typing has reached today's limit for everyone. Please type instead.",
        );
  }

  try {
    const result = await transcribeWithSarvam({
      audio,
      mode: sarvamModeFor(output),
      keyterms: buildKeyterms(context),
    });
    return NextResponse.json({
      text: result.transcript,
      languageCode: result.languageCode,
    });
  } catch (error) {
    await reservation.release().catch(() => {});
    console.error("[voice] transcription failed", error);

    if (error instanceof SarvamError) {
      if (
        error.kind === "out_of_credit" ||
        error.kind === "auth" ||
        error.kind === "not_configured"
      ) {
        return fail(
          503,
          "UNAVAILABLE",
          "Voice typing is unavailable right now. Please type instead.",
        );
      }
      if (error.kind === "busy") {
        return fail(429, "BUSY", "Voice typing is busy right now.");
      }
      if (error.kind === "bad_audio") {
        return fail(
          422,
          "BAD_AUDIO",
          "That part of the recording couldn't be understood.",
        );
      }
    }
    return fail(502, "FAILED", "Couldn't convert that part of the recording.");
  }
}
