// Voice typing: copies microphone samples off the audio thread in ~40 ms
// batches. Loaded by features/experiences/lib/voice/recorder.ts.
class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.length = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.length++] = channel[i];
        if (this.length === this.buffer.length) {
          this.port.postMessage(this.buffer.slice());
          this.length = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("voice-capture", VoiceCapture);
