/**
 * Settings shared by the voice button and the transcribe route. Plain
 * TypeScript, so the server can validate exactly what the client may send.
 */

/**
 * "english": whatever the student speaks (Kannada, Hindi, English or a mix),
 * the text comes out in English — what most readers want.
 * "spoken": the text stays in the language that was spoken.
 */
export const voiceOutputOptions = ["english", "spoken"] as const;
export type VoiceOutput = (typeof voiceOutputOptions)[number];

export const voiceOutputLabel: Record<VoiceOutput, string> = {
  english: "Convert to English",
  spoken: "Keep as spoken",
};

export function isVoiceOutput(value: unknown): value is VoiceOutput {
  return (
    typeof value === "string" &&
    (voiceOutputOptions as readonly string[]).includes(value)
  );
}

/** Sarvam mode for each choice. */
export function sarvamModeFor(output: VoiceOutput) {
  return output === "english" ? "translate" : "transcribe";
}

/** Each student may convert this much speech per day (IST). */
export const DAILY_SECONDS_PER_USER = 30 * 60;
/** Whole-site daily ceiling, so the Sarvam credit can't be drained in a day. */
export const DEFAULT_DAILY_SECONDS_SITE = 6 * 60 * 60;

/**
 * Words speech-to-text tends to mishear in placement writeups. Sarvam boosts
 * these when it hears something close. Kept short on purpose: Sarvam allows
 * 50 terms, and the company / role / stage are added per request.
 */
const BASE_KEYTERMS = [
  "DSA",
  "OOPS",
  "DBMS",
  "SQL",
  "operating systems",
  "computer networks",
  "system design",
  "LeetCode",
  "HackerRank",
  "dynamic programming",
  "binary search",
  "linked list",
  "two pointer",
  "sliding window",
  "recursion",
  "time complexity",
  "API",
  "REST",
  "JavaScript",
  "Python",
  "Java",
  "C++",
  "React",
  "Node.js",
  "aptitude",
  "online assessment",
  "group discussion",
  "HR round",
  "CGPA",
  "LPA",
];

const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 64;

/** Cleans what the client sent as context and merges it with the base terms. */
export function buildKeyterms(context: string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const raw of [...context, ...BASE_KEYTERMS]) {
    const term = raw
      .replace(/[\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_KEYTERM_LENGTH);
    const key = term.toLowerCase();
    if (term.length < 2 || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === MAX_KEYTERMS) break;
  }
  return terms;
}

/**
 * Adds spoken text after what is already in a box. Never replaces anything the
 * student typed, and keeps a line break if they had just started a new line.
 */
export function appendSpokenText(current: string, spoken: string): string {
  const text = spoken.trim();
  if (!text) return current;
  if (!current.trim()) return text;
  if (/\n\s*$/.test(current)) return current.replace(/[ \t]+$/, "") + text;
  return current.replace(/\s+$/, "") + " " + text;
}

/** The day used for limits, in India time, as YYYY-MM-DD. */
export function istDay(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}
