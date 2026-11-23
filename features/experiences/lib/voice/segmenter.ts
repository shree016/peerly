/**
 * Turns a live microphone stream into pieces Sarvam can transcribe. Sarvam's
 * real-time API takes at most 30 s per request, and students talk for minutes,
 * so the stream is cut into pieces — at a pause, so no word is split in two.
 *
 * Pure logic with no browser APIs, so it is tested without a microphone.
 */
import { MAX_SEGMENT_SECONDS, VOICE_SAMPLE_RATE } from "./wav";

/**
 * Converts the microphone's native rate (usually 48 kHz or 44.1 kHz) to
 * 16 kHz, one small chunk at a time. Recording at the native rate and
 * converting here works in every browser; asking the AudioContext for 16 kHz
 * fails in Firefox. The fractional read position carries over between chunks,
 * so 44.1 kHz input doesn't slowly drift out of time.
 */
export class StreamDownsampler {
  private readonly ratio: number;
  private pending = new Float32Array(0);
  private position = 0;

  constructor(inputRate: number, outputRate = VOICE_SAMPLE_RATE) {
    this.ratio = inputRate / outputRate;
  }

  process(chunk: Float32Array): Float32Array {
    const input = new Float32Array(this.pending.length + chunk.length);
    input.set(this.pending);
    input.set(chunk, this.pending.length);

    const out: number[] = [];
    while (this.position + this.ratio <= input.length) {
      const start = Math.floor(this.position);
      const end = Math.max(start + 1, Math.floor(this.position + this.ratio));
      let sum = 0;
      for (let i = start; i < end; i++) sum += input[i];
      out.push(sum / (end - start));
      this.position += this.ratio;
    }

    const consumed = Math.floor(this.position);
    this.pending = input.slice(consumed);
    this.position -= consumed;
    return Float32Array.from(out);
  }
}

export type Segment = {
  samples: Float32Array;
  /** False when the piece is only silence or background noise — not worth sending. */
  hasSpeech: boolean;
};

export type SegmenterOptions = {
  /** Don't look for a pause before this — fewer, longer pieces read better. */
  minSeconds?: number;
  /** Cut here even mid-sentence; must stay under Sarvam's 30 s limit. */
  maxSeconds?: number;
  /** How long a quiet stretch must be to count as a pause. */
  pauseSeconds?: number;
};

const FRAME_SECONDS = 0.1;
const FRAME = Math.round(VOICE_SAMPLE_RATE * FRAME_SECONDS);
/** Below this level a frame is silence, whatever the noise floor says. */
const MIN_THRESHOLD = 0.008;
/** Above this a frame is never silence, however noisy the room. */
const MAX_THRESHOLD = 0.05;
/** A piece needs this much speech (in frames) to be sent. */
const MIN_SPEECH_FRAMES = 3;
/** Anything shorter than this when recording stops is a click, not speech. */
const MIN_FLUSH_SECONDS = 0.3;

export class Segmenter {
  private readonly minFrames: number;
  private readonly maxFrames: number;
  private readonly pauseFrames: number;

  private chunks: Float32Array[] = [];
  private frameCount = 0;
  private partial = new Float32Array(0);
  private quietRun = 0;
  private speechFrames = 0;
  private noiseFloor = MIN_THRESHOLD;

  constructor(options: SegmenterOptions = {}) {
    const max = Math.min(options.maxSeconds ?? 27, MAX_SEGMENT_SECONDS);
    this.maxFrames = Math.floor(max / FRAME_SECONDS);
    this.minFrames = Math.floor(
      Math.min(options.minSeconds ?? 18, max) / FRAME_SECONDS,
    );
    this.pauseFrames = Math.max(
      1,
      Math.round((options.pauseSeconds ?? 0.4) / FRAME_SECONDS),
    );
  }

  /** Feeds 16 kHz samples; returns any pieces that are now complete. */
  push(samples: Float32Array): Segment[] {
    const done: Segment[] = [];
    let input = samples;
    if (this.partial.length) {
      input = new Float32Array(this.partial.length + samples.length);
      input.set(this.partial);
      input.set(samples, this.partial.length);
    }

    let offset = 0;
    while (offset + FRAME <= input.length) {
      const frame = input.slice(offset, offset + FRAME);
      offset += FRAME;
      this.addFrame(frame);

      const atPause =
        this.frameCount >= this.minFrames && this.quietRun >= this.pauseFrames;
      if (atPause || this.frameCount >= this.maxFrames) {
        done.push(this.cut());
      }
    }
    this.partial = input.slice(offset);
    return done;
  }

  /** Called when recording stops: returns whatever is left, if it's worth sending. */
  flush(): Segment | null {
    if (this.partial.length) {
      this.chunks.push(this.partial);
      this.partial = new Float32Array(0);
    }
    const length = this.chunks.reduce((n, c) => n + c.length, 0);
    if (length < MIN_FLUSH_SECONDS * VOICE_SAMPLE_RATE) {
      this.reset();
      return null;
    }
    return this.cut();
  }

  private addFrame(frame: Float32Array) {
    let sum = 0;
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    const rms = Math.sqrt(sum / frame.length);

    // The floor is the room's background noise. It drops quickly to quieter
    // frames and creeps up only on frames close to it; speech never moves it,
    // or a long stretch of talking would slowly start to count as "quiet".
    if (rms < this.noiseFloor) {
      this.noiseFloor = rms * 0.5 + this.noiseFloor * 0.5;
    } else if (rms < this.noiseFloor * 2) {
      this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02;
    }
    const threshold = Math.min(
      MAX_THRESHOLD,
      Math.max(MIN_THRESHOLD, this.noiseFloor * 3),
    );

    if (rms < threshold) {
      this.quietRun++;
    } else {
      this.quietRun = 0;
      if (rms > threshold * 2) this.speechFrames++;
    }

    this.chunks.push(frame);
    this.frameCount++;
  }

  private cut(): Segment {
    const length = this.chunks.reduce((n, c) => n + c.length, 0);
    const samples = new Float32Array(length);
    let at = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, at);
      at += chunk.length;
    }
    const segment = {
      samples,
      hasSpeech: this.speechFrames >= MIN_SPEECH_FRAMES,
    };
    this.reset();
    return segment;
  }

  private reset() {
    this.chunks = [];
    this.frameCount = 0;
    this.quietRun = 0;
    this.speechFrames = 0;
  }
}
