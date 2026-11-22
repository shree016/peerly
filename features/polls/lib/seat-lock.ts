import { sql } from "drizzle-orm";

import db from "@/db";

export type SeatLockResult =
  | { ok: true; responseId: string }
  | {
      ok: false;
      reason:
        | "OPTION_NOT_FOUND"
        | "POLL_NOT_OPEN"
        | "OPTION_UNAVAILABLE"
        | "OPTION_FULL";
    };

export const RESPONSE_UNIQUE_CONSTRAINT = "poll_response_poll_user_unique";

/**
 * Matches a Postgres error by SQLSTATE (and optionally constraint). drizzle's
 * neon-http driver wraps the NeonDbError in a DrizzleQueryError whose
 * `.cause` carries the real code/constraint, so both levels are checked.
 */
export function isPgError(
  error: unknown,
  code: string,
  constraintName?: string,
): boolean {
  for (const candidate of [error, (error as { cause?: unknown })?.cause]) {
    if (typeof candidate !== "object" || candidate === null) continue;
    if ((candidate as { code?: string }).code !== code) continue;
    if (
      !constraintName ||
      (candidate as { constraint?: string }).constraint === constraintName
    ) {
      return true;
    }
  }
  return false;
}

type LockRow = { updated_option_id: string | null; response_id: string | null };
type DiagRow = {
  poll_status: string;
  closes_at: Date | null;
  option_status: string;
  capacity: number | null;
  seats_taken: number;
  has_grant: boolean;
};

/**
 * Atomically locks one seat on `optionId` for `userId` and records the
 * response — a SINGLE statement, because the neon-http driver has no
 * interactive transactions.
 *
 * - The UPDATE's WHERE checks the option's own live `seats_taken < capacity`.
 *   When Postgres takes the row lock (possibly after waiting behind another
 *   submission for the same option) it re-evaluates that condition against
 *   the freshly committed row, so seats can never be oversold.
 * - The poll must be open AND not past `closes_at` AND the student in the
 *   audience — OR the student holds an active reopen grant.
 * - A second submission by the same user hits poll_response_poll_user_unique
 *   (23505). The error aborts the whole statement, rolling back the seat
 *   increment too, so a rejected double-submit never leaves a phantom seat.
 */
export async function lockSeat(params: {
  pollId: string;
  optionId: string;
  userId: string;
  inAudience: boolean;
  studentId: string | null;
  studentUsn: string | null;
  studentName: string | null;
  studentBatch: string | null;
  studentSection: string | null;
  reopenGrantId: string | null;
}): Promise<SeatLockResult> {
  const responseId = crypto.randomUUID();
  const choiceId = crypto.randomUUID();

  const result = await db.execute<LockRow>(sql`
    WITH updated_option AS (
      UPDATE poll_option AS o
      SET seats_taken = o.seats_taken + 1, updated_at = now()
      FROM poll AS p
      WHERE o.id = ${params.optionId}
        AND o.poll_id = ${params.pollId}
        AND p.id = o.poll_id
        AND p.kind = 'seatlock'
        AND p.status <> 'draft'
        AND (
          (
            p.status = 'open'
            AND (p.closes_at IS NULL OR p.closes_at > now())
            AND ${params.inAudience}::boolean
          )
          OR EXISTS (
            SELECT 1 FROM poll_reopen_grant g
            WHERE g.poll_id = p.id
              AND g.student_id = ${params.studentId}
              AND g.revoked_at IS NULL
          )
        )
        AND o.status = 'active'
        AND o.capacity IS NOT NULL
        AND o.seats_taken < o.capacity
      RETURNING o.id
    ),
    inserted_response AS (
      INSERT INTO poll_response
        (id, poll_id, user_id, student_usn, student_name, student_batch, student_section, reopen_grant_id, submitted_at, updated_at)
      SELECT ${responseId}, ${params.pollId}, ${params.userId},
             ${params.studentUsn}, ${params.studentName}, ${params.studentBatch}, ${params.studentSection},
             ${params.reopenGrantId}, now(), now()
      FROM updated_option
      RETURNING id
    ),
    inserted_choice AS (
      INSERT INTO poll_response_option (id, response_id, poll_id, option_id)
      SELECT ${choiceId}, ir.id, ${params.pollId}, ${params.optionId}
      FROM inserted_response ir
      RETURNING id
    )
    SELECT
      (SELECT id FROM updated_option) AS updated_option_id,
      (SELECT id FROM inserted_response) AS response_id,
      (SELECT id FROM inserted_choice) AS choice_id
  `);

  const row = result.rows[0];
  if (row?.updated_option_id && row.response_id) {
    return { ok: true, responseId: row.response_id };
  }

  // Nothing matched — a read-only diagnostic decides the error wording only.
  const diag = await db.execute<DiagRow>(sql`
    SELECT
      p.status AS poll_status,
      p.closes_at,
      o.status AS option_status,
      o.capacity,
      o.seats_taken,
      EXISTS (
        SELECT 1 FROM poll_reopen_grant g
        WHERE g.poll_id = p.id
          AND g.student_id = ${params.studentId}
          AND g.revoked_at IS NULL
      ) AS has_grant
    FROM poll_option o
    JOIN poll p ON p.id = o.poll_id
    WHERE o.id = ${params.optionId} AND o.poll_id = ${params.pollId}
  `);
  const d = diag.rows[0];
  if (!d) return { ok: false, reason: "OPTION_NOT_FOUND" };
  const expired = d.closes_at !== null && new Date(d.closes_at) <= new Date();
  if (
    (d.poll_status !== "open" || expired || !params.inAudience) &&
    !d.has_grant
  ) {
    return { ok: false, reason: "POLL_NOT_OPEN" };
  }
  if (d.option_status !== "active")
    return { ok: false, reason: "OPTION_UNAVAILABLE" };
  return { ok: false, reason: "OPTION_FULL" };
}
