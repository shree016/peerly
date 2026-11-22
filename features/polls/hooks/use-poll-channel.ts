"use client";

import { useEffect, useRef } from "react";

import { createClient } from "@/features/quiz/lib/supabase-client";

type Handler = (
  event: "seats" | "status" | "responses",
  payload: Record<string, unknown>,
) => void;

/**
 * Subscribes to a poll's public Realtime channel. Payloads carry counts and
 * status only (see features/polls/lib/realtime.ts). No-ops when Supabase
 * isn't configured.
 */
export function usePollChannel(pollId: string, onEvent: Handler) {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      return;
    }
    const supabase = createClient();
    const channel = supabase.channel(`poll:${pollId}`);
    for (const event of ["seats", "status", "responses"] as const) {
      channel.on("broadcast", { event }, ({ payload }) =>
        handlerRef.current(event, (payload ?? {}) as Record<string, unknown>),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pollId]);
}
