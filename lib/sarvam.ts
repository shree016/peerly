/**
 * Sarvam AI speech-to-text (Saaras v4). Import this only from server code
 * (the transcribe route) — the API key must never reach the browser. Docs: https://docs.sarvam.ai/api-reference-docs/speech-to-text/transcribe
 */

const ENDPOINT = "https://api.sarvam.ai/speech-to-text";
const MODEL = "saaras:v4";
const TIMEOUT_MS = 25_000;

export type SarvamFailure =
  | "not_configured"
  | "out_of_credit"
  | "busy"
  | "bad_audio"
  | "auth"
  | "unavailable";

export class SarvamError extends Error {
  constructor(
    readonly kind: SarvamFailure,
    message: string,
  ) {
    super(message);
    this.name = "SarvamError";
  }
}

export function isSarvamConfigured() {
  return Boolean(process.env.SARVAM_API_KEY);
}

export async function transcribeWithSarvam(input: {
  audio: Uint8Array<ArrayBuffer>;
  mode: "translate" | "transcribe";
  keyterms: string[];
}): Promise<{ transcript: string; languageCode: string | null }> {
  const key = process.env.SARVAM_API_KEY;
  if (!key)
    throw new SarvamError("not_configured", "SARVAM_API_KEY is not set");

  const form = new FormData();
  form.append(
    "file",
    new Blob([input.audio], { type: "audio/wav" }),
    "speech.wav",
  );
  form.append("model", MODEL);
  form.append("mode", input.mode);
  form.append("language_code", "unknown");
  if (input.keyterms.length) {
    form.append("keyterms", JSON.stringify(input.keyterms));
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "api-subscription-key": key },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new SarvamError(
      "unavailable",
      `Sarvam request failed: ${error instanceof Error ? error.message : error}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SarvamError(
      failureFor(response.status, detail),
      `Sarvam ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    transcript?: unknown;
    language_code?: unknown;
  };
  return {
    transcript:
      typeof data.transcript === "string" ? data.transcript.trim() : "",
    languageCode:
      typeof data.language_code === "string" ? data.language_code : null,
  };
}

function failureFor(status: number, body: string): SarvamFailure {
  if (status === 402 || body.includes("insufficient_quota"))
    return "out_of_credit";
  if (status === 429) return "busy";
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 422) return "bad_audio";
  return "unavailable";
}
