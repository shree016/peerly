import { Segment, Segmenter, StreamDownsampler } from "./segmenter";

/**
 * Records the microphone as raw samples and hands out speech pieces ready to
 * transcribe. Raw samples (not MediaRecorder) because MediaRecorder chunks
 * can't be cut into separate files, and iPhone Safari records a different
 * format from everyone else.
 */

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextClass })
      .webkitAudioContext
  );
}

export function isVoiceRecordingSupported() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    Boolean(audioContextClass()) &&
    (typeof window === "undefined" || window.isSecureContext)
  );
}

export type RecorderHandlers = {
  onSegment: (segment: Segment) => void;
  /** Rough loudness 0..1, for the "it's listening" meter. */
  onLevel: (level: number) => void;
  /** The microphone went away on its own (unplugged, permission revoked). */
  onEnded: () => void;
};

/** Turns getUserMedia's error into a sentence a student can act on. */
export function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow the microphone for this site (or the Peeerly app) and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The microphone is being used by another app. Close it and try again.";
  }
  return "Couldn't start the microphone.";
}

export class VoiceRecorder {
  private readonly context: AudioContext;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioNode | null = null;
  private mute: GainNode | null = null;
  private downsampler: StreamDownsampler;
  private segmenter = new Segmenter();
  private stopped = false;

  /**
   * Must run directly inside the click handler, before any await: Safari only
   * lets an AudioContext start from a user gesture.
   */
  constructor(private readonly handlers: RecorderHandlers) {
    const Context = audioContextClass();
    if (!Context) throw new Error("Audio recording is not supported here.");
    this.context = new Context();
    void this.context.resume().catch(() => {});
    this.downsampler = new StreamDownsampler(this.context.sampleRate);
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (this.stopped) return this.release();

      this.source = this.context.createMediaStreamSource(this.stream);
      this.node = await this.captureNode();
      if (this.stopped) return this.release();

      // The capture node only runs while connected to the speakers, so it goes
      // through a silent gain — nothing is played back.
      this.mute = this.context.createGain();
      this.mute.gain.value = 0;
      this.source.connect(this.node);
      this.node.connect(this.mute);
      this.mute.connect(this.context.destination);
      await this.context.resume();

      this.stream.getAudioTracks()[0]?.addEventListener("ended", () => {
        if (!this.stopped) {
          this.stop();
          this.handlers.onEnded();
        }
      });
    } catch (error) {
      this.release();
      throw error;
    }
  }

  /** Stops the microphone and hands out whatever was said since the last piece. */
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    const last = this.segmenter.flush();
    if (last?.hasSpeech) this.handlers.onSegment(last);
    this.release();
  }

  private async captureNode(): Promise<AudioNode> {
    if (this.context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      await this.context.audioWorklet.addModule("/voice-capture-worklet.js");
      const worklet = new AudioWorkletNode(this.context, "voice-capture");
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) =>
        this.handle(event.data);
      return worklet;
    }
    // Older WebViews without AudioWorklet.
    const processor = this.context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) =>
      this.handle(new Float32Array(event.inputBuffer.getChannelData(0)));
    return processor;
  }

  private handle(chunk: Float32Array) {
    if (this.stopped) return;
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    this.handlers.onLevel(Math.min(1, Math.sqrt(sum / chunk.length) * 8));

    for (const segment of this.segmenter.push(
      this.downsampler.process(chunk),
    )) {
      if (segment.hasSpeech) this.handlers.onSegment(segment);
    }
  }

  private release() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    this.node?.disconnect();
    this.mute?.disconnect();
    if (this.node instanceof AudioWorkletNode) this.node.port.onmessage = null;
    if (this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.stream = null;
  }
}
