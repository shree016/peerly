import { VoiceOutput } from "./options";

const ENDPOINT = "/api/experiences/v1/transcribe";
const RETRY_DELAYS_MS = [1500, 4000];

export type TranscribeResult =
  | { ok: true; text: string }
  /**
   * fatal: voice typing can't continue (logged out, daily limit, not set up) —
   * stop recording. Otherwise only this piece failed.
   * retryable: worth offering a "Retry" button (network or Sarvam hiccup).
   */
  | { ok: false; fatal: boolean; retryable: boolean; message: string };

const FATAL_CODES = new Set([
  "UNAUTHORIZED",
  "NOT_CONFIGURED",
  "UNAVAILABLE",
  "DAILY_LIMIT",
  "SITE_LIMIT",
]);

async function sendOnce(
  wav: Uint8Array<ArrayBuffer>,
  output: VoiceOutput,
  context: string[],
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("audio", new Blob([wav], { type: "audio/wav" }), "speech.wav");
  form.append("output", output);
  for (const term of context) {
    if (term.trim()) form.append("context", term.trim());
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, { method: "POST", body: form });
  } catch {
    return {
      ok: false,
      fatal: false,
      retryable: true,
      message:
        "No internet connection — part of your recording wasn't converted.",
    };
  }

  const body = (await response.json().catch(() => null)) as {
    text?: string;
    error?: { code?: string; message?: string };
  } | null;

  if (response.ok) return { ok: true, text: body?.text?.trim() ?? "" };

  const code = body?.error?.code ?? "";
  const message =
    body?.error?.message ?? "Couldn't convert part of your recording.";
  if (FATAL_CODES.has(code) || response.status === 401) {
    return { ok: false, fatal: true, retryable: false, message };
  }
  const retryable =
    code === "BUSY" ||
    code === "TOO_FAST" ||
    code === "FAILED" ||
    response.status >= 500;
  return { ok: false, fatal: false, retryable, message };
}

/** Sends one piece, quietly retrying network and Sarvam hiccups. */
export async function transcribeSegment(
  wav: Uint8Array<ArrayBuffer>,
  output: VoiceOutput,
  context: string[],
): Promise<TranscribeResult> {
  let result = await sendOnce(wav, output, context);
  for (const delay of RETRY_DELAYS_MS) {
    if (result.ok || !result.retryable) return result;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await sendOnce(wav, output, context);
  }
  return result;
}
