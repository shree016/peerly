/**
 * Pure-logic tests for voice typing: WAV format, resampling, cutting speech
 * at pauses, key terms, and adding text to a box. No microphone, no network,
 * no Sarvam calls.
 *
 *   npm run test:voice
 */
import assert from "node:assert/strict";

import {
  appendSpokenText,
  buildKeyterms,
  isVoiceOutput,
  istDay,
  sarvamModeFor,
} from "../features/experiences/lib/voice/options";
import {
  Segmenter,
  StreamDownsampler,
} from "../features/experiences/lib/voice/segmenter";
import {
  MAX_WAV_BYTES,
  VOICE_SAMPLE_RATE,
  encodeWav,
  readVoiceWav,
} from "../features/experiences/lib/voice/wav";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const RATE = VOICE_SAMPLE_RATE;

/** "Speech": a loud 220 Hz tone. "Pause": near silence with a little noise. */
function speech(seconds: number) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++)
    out[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return out;
}
function pause(seconds: number) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = (Math.random() - 0.5) * 0.002;
  return out;
}
function join(...parts: Float32Array[]) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
/** Feeds audio in small browser-sized chunks, like the real recorder. */
function feed(segmenter: Segmenter, audio: Float32Array, chunk = 683) {
  const segments = [];
  for (let i = 0; i < audio.length; i += chunk) {
    segments.push(...segmenter.push(audio.slice(i, i + chunk)));
  }
  return segments;
}
const seconds = (samples: Float32Array) => samples.length / RATE;

// ── WAV ─────────────────────────────────────────────────────────────────────

test("encodeWav output is accepted by readVoiceWav with the right length", () => {
  const wav = encodeWav(speech(2.5));
  const info = readVoiceWav(wav);
  assert.ok(info);
  assert.equal(info.durationSeconds, 2.5);
});

test("samples are clipped to 16-bit range", () => {
  const wav = encodeWav(Float32Array.from([2, -2, 0]));
  const view = new DataView(wav.buffer);
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(46, true), -32768);
  assert.equal(view.getInt16(48, true), 0);
});

test("readVoiceWav rejects anything that isn't our exact format", () => {
  const good = encodeWav(speech(1));
  const wrongRate = good.slice();
  new DataView(wrongRate.buffer).setUint32(24, 44_100, true);
  const stereo = good.slice();
  new DataView(stereo.buffer).setUint16(22, 2, true);
  const truncated = good.slice(0, good.length - 10);
  const notWav = new TextEncoder().encode(
    "ID3 this is an mp3 pretending".padEnd(100),
  );

  assert.equal(readVoiceWav(wrongRate), null);
  assert.equal(readVoiceWav(stereo), null);
  assert.equal(readVoiceWav(truncated), null);
  assert.equal(readVoiceWav(notWav), null);
  assert.equal(readVoiceWav(new Uint8Array(10)), null);
  assert.equal(readVoiceWav(encodeWav(new Float32Array(0))), null);
});

test("a maximum-length piece fits the server's size cap", () => {
  assert.ok(encodeWav(speech(29)).length <= MAX_WAV_BYTES);
  assert.ok(encodeWav(speech(29.5)).length > MAX_WAV_BYTES);
});

// ── Resampling ──────────────────────────────────────────────────────────────

for (const inputRate of [48_000, 44_100, 16_000]) {
  test(`downsampler keeps time at ${inputRate} Hz over 60 s of small chunks`, () => {
    const down = new StreamDownsampler(inputRate);
    let produced = 0;
    const chunk = new Float32Array(128).fill(0.1);
    const chunks = Math.round((60 * inputRate) / 128);
    for (let i = 0; i < chunks; i++) produced += down.process(chunk).length;
    const expected = (chunks * 128 * RATE) / inputRate;
    assert.ok(Math.abs(produced - expected) <= 2, `${produced} vs ${expected}`);
  });
}

test("downsampler averages, so a constant level stays the same", () => {
  const out = new StreamDownsampler(48_000).process(
    new Float32Array(4800).fill(0.25),
  );
  assert.ok(out.every((v) => Math.abs(v - 0.25) < 1e-6));
});

// ── Cutting at pauses ───────────────────────────────────────────────────────

test("short speech gives one piece, only when recording stops", () => {
  const s = new Segmenter();
  assert.equal(feed(s, speech(5)).length, 0);
  const last = s.flush();
  assert.ok(last?.hasSpeech);
  assert.ok(Math.abs(seconds(last.samples) - 5) < 0.11);
});

test("a pause after the minimum length cuts there, not mid-word", () => {
  const s = new Segmenter({
    minSeconds: 18,
    maxSeconds: 27,
    pauseSeconds: 0.4,
  });
  const pieces = feed(s, join(speech(20), pause(1), speech(6)));
  assert.equal(pieces.length, 1);
  const len = seconds(pieces[0].samples);
  // Cut inside the pause: after the 20 s of speech, before speech resumes.
  assert.ok(len > 20.3 && len <= 21, `cut at ${len}s`);
  const rest = s.flush();
  assert.ok(rest?.hasSpeech);
});

test("pauses before the minimum length don't cut", () => {
  const s = new Segmenter({ minSeconds: 18 });
  const pieces = feed(
    s,
    join(speech(5), pause(1), speech(5), pause(1), speech(5)),
  );
  assert.equal(pieces.length, 0);
});

test("non-stop speech is cut at the maximum, always under Sarvam's 30 s", () => {
  const s = new Segmenter();
  const pieces = feed(s, speech(70));
  assert.ok(pieces.length >= 2);
  for (const piece of pieces) {
    assert.ok(seconds(piece.samples) <= 27.01);
    assert.ok(readVoiceWav(encodeWav(piece.samples)));
  }
  const rest = s.flush();
  const total =
    pieces.reduce((n, p) => n + seconds(p.samples), 0) + seconds(rest!.samples);
  assert.ok(Math.abs(total - 70) < 0.01, "no audio lost or duplicated");
});

test("long steady speech never starts counting as a pause", () => {
  // Regression: the noise estimate used to creep up to the speaking level and
  // cut at 18 s in the middle of a sentence.
  const s = new Segmenter();
  const pieces = feed(s, speech(60));
  assert.ok(
    seconds(pieces[0].samples) >= 26.9,
    `first cut at ${seconds(pieces[0].samples)}s`,
  );
});

test("pauses are still found in a noisy room", () => {
  const noisy = (audio: Float32Array) =>
    audio.map((v) => v + (Math.random() - 0.5) * 0.05); // ~0.015 RMS hum
  const s = new Segmenter();
  const pieces = feed(
    s,
    noisy(join(pause(2), speech(19), pause(1), speech(5))),
  );
  assert.equal(pieces.length, 1);
  const len = seconds(pieces[0].samples);
  assert.ok(len > 21.3 && len <= 22, `cut at ${len}s`);
});

test("maxSeconds above 29 is clamped to 29", () => {
  const s = new Segmenter({ maxSeconds: 60 });
  const pieces = feed(s, speech(40));
  assert.ok(seconds(pieces[0].samples) <= 29.01);
});

test("silence is marked as not worth sending", () => {
  const s = new Segmenter();
  const pieces = feed(s, pause(60));
  assert.ok(pieces.length >= 2);
  assert.ok(pieces.every((p) => !p.hasSpeech));
  assert.equal(s.flush()?.hasSpeech ?? false, false);
});

test("a click shorter than 0.3 s on stop is dropped", () => {
  const s = new Segmenter();
  feed(s, speech(0.2));
  assert.equal(s.flush(), null);
});

// ── Options ────────────────────────────────────────────────────────────────

test("output choice maps to Sarvam modes and rejects junk", () => {
  assert.equal(sarvamModeFor("english"), "translate");
  assert.equal(sarvamModeFor("spoken"), "transcribe");
  assert.equal(isVoiceOutput("english"), true);
  assert.equal(isVoiceOutput("codemix"), false);
  assert.equal(isVoiceOutput(null), false);
});

test("key terms: context first, de-duplicated, trimmed, within Sarvam's limits", () => {
  const terms = buildKeyterms([
    "  Infosys ",
    "SDE\nIntern",
    "dsa",
    "x",
    "A".repeat(100),
  ]);
  assert.equal(terms[0], "Infosys");
  assert.equal(terms[1], "SDE Intern");
  assert.ok(terms.includes("dsa"));
  assert.ok(!terms.includes("DSA"), "case-insensitive duplicate dropped");
  assert.ok(!terms.includes("x"));
  assert.ok(terms.every((t) => t.length <= 64));
  assert.ok(terms.length <= 50);
  assert.equal(
    buildKeyterms(Array.from({ length: 80 }, (_, i) => `term ${i}`)).length,
    50,
  );
});

test("spoken text is added after typed text, never replacing it", () => {
  assert.equal(appendSpokenText("", " Hello "), "Hello");
  assert.equal(
    appendSpokenText("I wrote this.", "Then I said this."),
    "I wrote this. Then I said this.",
  );
  assert.equal(appendSpokenText("Line one\n", "two"), "Line one\ntwo");
  assert.equal(appendSpokenText("Typed  ", "spoken"), "Typed spoken");
  assert.equal(appendSpokenText("Keep me", "   "), "Keep me");
});

test("daily limit day is India time", () => {
  // 20:00 UTC on Jan 1 is 01:30 IST on Jan 2.
  assert.equal(istDay(new Date("2026-01-01T20:00:00Z")), "2026-01-02");
  assert.equal(istDay(new Date("2026-01-01T18:00:00Z")), "2026-01-01");
});

console.log(`✓ ${passed} voice typing checks passed`);
