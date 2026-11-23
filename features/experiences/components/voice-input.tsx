"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { ChevronDown, Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";

import {
  VoiceOutput,
  isVoiceOutput,
  voiceOutputLabel,
  voiceOutputOptions,
} from "../lib/voice/options";
import {
  VoiceRecorder,
  isVoiceRecordingSupported,
  microphoneErrorMessage,
} from "../lib/voice/recorder";
import { Segment } from "../lib/voice/segmenter";
import { transcribeSegment } from "../lib/voice/transcribe-client";
import { encodeWav } from "../lib/voice/wav";

/** One press records at most this long, so a forgotten mic doesn't run on. */
const MAX_RECORDING_SECONDS = 10 * 60;
const TOAST_ID = "voice-typing";

// ── Shared state for every voice button on the page ─────────────────────────

const OUTPUT_KEY = "peeerly.voice-output";
const outputListeners = new Set<() => void>();

function readOutput(): VoiceOutput {
  try {
    const stored = localStorage.getItem(OUTPUT_KEY);
    return isVoiceOutput(stored) ? stored : "english";
  } catch {
    return "english";
  }
}

function writeOutput(value: VoiceOutput) {
  try {
    localStorage.setItem(OUTPUT_KEY, value);
  } catch {
    // Private mode: the choice just isn't remembered.
  }
  outputListeners.forEach((listener) => listener());
}

function subscribeOutput(listener: () => void) {
  outputListeners.add(listener);
  return () => outputListeners.delete(listener);
}

const noSubscribe = () => () => {};

/** Only one microphone at a time: starting a button stops the previous one. */
let activeMic: { owner: object; stop: () => void } | null = null;

/** Buttons that are recording or still converting, so a form can wait for them. */
const busyButtons = new Set<string>();
const busyListeners = new Set<() => void>();

function setBusy(id: string, busy: boolean) {
  const changed = busy ? !busyButtons.has(id) : busyButtons.has(id);
  if (!changed) return;
  if (busy) busyButtons.add(id);
  else busyButtons.delete(id);
  busyListeners.forEach((listener) => listener());
}

function subscribeBusy(listener: () => void) {
  busyListeners.add(listener);
  return () => busyListeners.delete(listener);
}

/**
 * True while any voice button is listening or converting. Forms disable
 * submit meanwhile, so the last few seconds of speech aren't lost.
 */
export function useVoiceTypingBusy() {
  return useSyncExternalStore(
    subscribeBusy,
    () => busyButtons.size > 0,
    () => false,
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── The button ──────────────────────────────────────────────────────────────

type MicState = "off" | "starting" | "on";

/**
 * "Speak" button for a text box: records, converts each piece of speech to
 * text as the student talks, and adds it to the end of the box.
 */
export function VoiceInputButton({
  id,
  onText,
  context = [],
  fieldLabel,
  disabled,
  className,
}: {
  /** Unique on the page, e.g. "overview" or "round-<clientId>". */
  id: string;
  /** Receives each converted piece; append it, never replace. */
  onText: (text: string) => void;
  /** Company, role, stage — helps Sarvam spell them correctly. */
  context?: string[];
  /** For screen readers: "Speak to fill <fieldLabel>". */
  fieldLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const supported = useSyncExternalStore(
    noSubscribe,
    isVoiceRecordingSupported,
    () => false,
  );
  const output = useSyncExternalStore(
    subscribeOutput,
    readOutput,
    () => "english" as const,
  );

  const [mic, setMic] = useState<MicState>("off");
  const [pending, setPending] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const recorderRef = useRef<VoiceRecorder | null>(null);
  const queueRef = useRef<Uint8Array<ArrayBuffer>[]>([]);
  const failedRef = useRef<Uint8Array<ArrayBuffer>[]>([]);
  const workingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef<HTMLSpanElement | null>(null);
  /** This button's identity in activeMic. */
  const ownerRef = useRef({});

  // Read at send time, so queued pieces use the latest callback and context.
  const onTextRef = useRef(onText);
  const contextRef = useRef(context);
  const outputRef = useRef<VoiceOutput>(output);
  useEffect(() => {
    onTextRef.current = onText;
    contextRef.current = context;
  });

  useEffect(() => {
    setBusy(id, mic !== "off" || pending > 0);
  }, [id, mic, pending]);
  useEffect(() => () => setBusy(id, false), [id]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (activeMic?.owner === ownerRef.current) activeMic = null;
    recorder.stop(); // hands out the last piece, if any
    setMic("off");
    setAnnouncement("Stopped listening.");
  }, []);

  const pump = useCallback(async () => {
    if (workingRef.current) return;
    workingRef.current = true;
    try {
      while (queueRef.current.length) {
        const wav = queueRef.current.shift()!;
        const result = await transcribeSegment(
          wav,
          outputRef.current,
          contextRef.current,
        );
        setPending((n) => Math.max(0, n - 1));

        if (result.ok) {
          if (result.text) {
            onTextRef.current(result.text);
            setAnnouncement("Text added.");
          }
          continue;
        }
        if (result.fatal) {
          stop();
          const dropped = queueRef.current.length;
          queueRef.current = [];
          setPending((n) => Math.max(0, n - dropped));
          toast.error(result.message, { id: TOAST_ID });
          break;
        }
        if (result.retryable) {
          failedRef.current.push(wav);
          toast.error(result.message, {
            id: TOAST_ID,
            duration: 15_000,
            action: { label: "Retry", onClick: () => retryFailed() },
          });
        } else {
          toast.warning(result.message, { id: TOAST_ID });
        }
      }
    } finally {
      workingRef.current = false;
    }
    // retryFailed is defined below and only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  function retryFailed() {
    const failed = failedRef.current;
    failedRef.current = [];
    queueRef.current.push(...failed);
    setPending((n) => n + failed.length);
    void pump();
  }

  const enqueue = useCallback(
    (segment: Segment) => {
      queueRef.current.push(encodeWav(segment.samples));
      setPending((n) => n + 1);
      void pump();
    },
    [pump],
  );

  async function start() {
    activeMic?.stop();
    outputRef.current = output;

    let recorder: VoiceRecorder;
    try {
      // Created inside the click, before any await (Safari needs that).
      recorder = new VoiceRecorder({
        onSegment: enqueue,
        onLevel: (level) => {
          if (levelRef.current)
            levelRef.current.style.transform = `scaleX(${level})`;
        },
        onEnded: () => {
          stop();
          toast.error("The microphone stopped.", { id: TOAST_ID });
        },
      });
    } catch (error) {
      toast.error(microphoneErrorMessage(error), { id: TOAST_ID });
      return;
    }

    recorderRef.current = recorder;
    activeMic = { owner: ownerRef.current, stop };
    setMic("starting");
    setElapsed(0);

    try {
      await recorder.start();
    } catch (error) {
      if (recorderRef.current === recorder) {
        recorderRef.current = null;
        if (activeMic?.owner === ownerRef.current) activeMic = null;
        setMic("off");
      }
      toast.error(microphoneErrorMessage(error), { id: TOAST_ID });
      return;
    }
    if (recorderRef.current !== recorder) return; // stopped while starting

    setMic("on");
    setAnnouncement("Listening. Speak now.");
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) {
        stop();
        toast.info("Stopped after 10 minutes. Tap Speak to keep going.", {
          id: TOAST_ID,
        });
      }
    }, 500);
  }

  // Leaving the page or switching apps stops the microphone, so it never
  // keeps listening in the background.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      stop();
    };
  }, [stop]);

  if (!supported) return null;

  const live = (
    <span className="sr-only" aria-live="polite">
      {announcement}
    </span>
  );

  if (mic !== "off") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 py-1 pr-1 pl-2.5 text-xs text-red-700 dark:text-red-300",
          className,
        )}
      >
        {live}
        {mic === "starting" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            <span>Starting mic…</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="tabular-nums">{formatElapsed(elapsed)}</span>
            <span
              className="h-1 w-8 overflow-hidden rounded-full bg-red-500/20"
              aria-hidden
            >
              <span
                ref={levelRef}
                className="block h-full w-full origin-left bg-red-500 transition-transform duration-75"
                style={{ transform: "scaleX(0)" }}
              />
            </span>
            {pending > 0 && (
              <Loader2
                className="h-3 w-3 animate-spin"
                aria-label="Converting"
              />
            )}
          </>
        )}
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 font-medium text-white hover:bg-red-600"
        >
          <Square className="h-2.5 w-2.5 fill-current" aria-hidden />
          Stop
        </button>
      </div>
    );
  }

  if (pending > 0) {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1.5 py-1 text-xs",
          className,
        )}
      >
        {live}
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Converting to text…
      </span>
    );
  }

  return (
    <div
      className={cn(
        "bg-card inline-flex items-center rounded-full border text-xs shadow-xs",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {live}
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        aria-label={`Speak to fill ${fieldLabel}`}
        className="hover:bg-accent inline-flex items-center gap-1.5 rounded-l-full py-1 pr-2 pl-2.5 font-medium"
      >
        <Mic className="h-3.5 w-3.5" aria-hidden />
        Speak
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Voice typing output: ${voiceOutputLabel[output]}`}
            className="text-muted-foreground hover:bg-accent inline-flex items-center gap-0.5 rounded-r-full border-l py-1 pr-2 pl-1.5"
          >
            {output === "english" ? "EN" : "As spoken"}
            <ChevronDown className="h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Voice typing writes</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={output}
            onValueChange={(value) => {
              if (isVoiceOutput(value)) writeOutput(value);
            }}
          >
            {voiceOutputOptions.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                <div>
                  <p>{voiceOutputLabel[option]}</p>
                  <p className="text-muted-foreground text-xs">
                    {option === "english"
                      ? "Speak Kannada, Hindi, English or a mix — get English text."
                      : "Text stays in the language you spoke."}
                  </p>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One line under a form's title, telling students what happens to their voice. */
export function VoiceTypingNote({ className }: { className?: string }) {
  const supported = useSyncExternalStore(
    noSubscribe,
    isVoiceRecordingSupported,
    () => false,
  );
  if (!supported) return null;
  return (
    <p
      className={cn(
        "text-muted-foreground flex items-start gap-1.5 text-xs",
        className,
      )}
    >
      <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        Tap <span className="text-foreground font-medium">Speak</span> on any
        box to talk instead of typing, then check the text. Your voice is sent
        to Sarvam AI to turn it into text; Peeerly doesn&apos;t keep the
        recording.
      </span>
    </p>
  );
}
