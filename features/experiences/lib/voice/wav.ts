/**
 * The one audio format voice typing uses end to end: 16 kHz, mono, 16-bit PCM
 * WAV. The browser builds it and the server checks it, so both sides import
 * this file. Plain TypeScript with no browser or Node APIs, so it is testable.
 */

export const VOICE_SAMPLE_RATE = 16_000;
/** Sarvam's real-time API rejects anything over 30 s; we stay under it. */
export const MAX_SEGMENT_SECONDS = 29;

const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

/** Encodes mono float samples (-1..1) as a 16-bit PCM WAV file. */
export function encodeWav(
  samples: Float32Array,
  sampleRate = VOICE_SAMPLE_RATE,
): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * BYTES_PER_SAMPLE, true); // byte rate
  view.setUint16(32, BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = HEADER_BYTES;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += BYTES_PER_SAMPLE;
  }
  return new Uint8Array(buffer);
}

export type WavInfo = { durationSeconds: number };

/**
 * Accepts only the exact WAV layout encodeWav writes and returns its length.
 * The server uses this so our Sarvam key can't be used to transcribe arbitrary
 * uploads, and so the daily limit counts real seconds, not what the client says.
 */
export function readVoiceWav(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < HEADER_BYTES) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (readAscii(view, 0) !== "RIFF" || readAscii(view, 8) !== "WAVE")
    return null;
  if (readAscii(view, 12) !== "fmt " || view.getUint32(16, true) !== 16)
    return null;
  if (view.getUint16(20, true) !== 1) return null; // PCM
  if (view.getUint16(22, true) !== 1) return null; // mono
  if (view.getUint32(24, true) !== VOICE_SAMPLE_RATE) return null;
  if (view.getUint16(34, true) !== 16) return null;
  if (readAscii(view, 36) !== "data") return null;

  const dataBytes = view.getUint32(40, true);
  if (dataBytes === 0 || dataBytes !== bytes.length - HEADER_BYTES) return null;

  return {
    durationSeconds: dataBytes / (VOICE_SAMPLE_RATE * BYTES_PER_SAMPLE),
  };
}

/** The largest file the server accepts: one maximum-length segment. */
export const MAX_WAV_BYTES =
  HEADER_BYTES + MAX_SEGMENT_SECONDS * VOICE_SAMPLE_RATE * BYTES_PER_SAMPLE;

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function readAscii(view: DataView, offset: number) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}
