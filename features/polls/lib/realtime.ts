/**
 * Broadcasts a Realtime event on a poll's channel via the Supabase Realtime
 * REST endpoint (same mechanism as features/quiz/lib/realtime.ts).
 *
 * PRIVACY: these channels are public — anyone with the anon key can listen —
 * so payloads must only ever carry ids, counts and status. Never names,
 * USNs, emails or individual answers.
 */
export type PollBroadcast =
  | {
      event: "seats";
      payload: {
        options: { id: string; seatsTaken: number; capacity: number | null }[];
      };
    }
  | { event: "status"; payload: { status: string } }
  | { event: "responses"; payload: { total: number } };

export async function broadcastPollEvent(
  pollId: string,
  message: PollBroadcast,
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `poll:${pollId}`,
            event: message.event,
            payload: message.payload,
            private: false,
          },
        ],
      }),
    });
  } catch {
    // Best-effort — never fail the caller because of a broadcast.
  }
}
