import { sql } from "drizzle-orm";

import db from "@/db";
import { emailSendLimit } from "@/db/schema";

const WINDOW = sql.raw(`interval '60 minutes'`);
const MAX_PER_WINDOW = 3;

/**
 * Counts one send of `kind` to this address and says whether it is allowed.
 * Anyone can type someone else's address into sign-up or sign-in, so without
 * this the site could be used to flood that inbox.
 *
 * One upsert, so two requests at the same moment can't both slip under the cap.
 */
export async function allowEmailSend(kind: string, email: string) {
  const key = `${kind}:${email.trim().toLowerCase()}`;
  const expired = sql`${emailSendLimit.windowStart} < now() - ${WINDOW}`;

  const [row] = await db
    .insert(emailSendLimit)
    .values({ key, count: 1, windowStart: sql`now()` })
    .onConflictDoUpdate({
      target: emailSendLimit.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${emailSendLimit.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${emailSendLimit.windowStart} END`,
      },
    })
    .returning({ count: emailSendLimit.count });

  return row.count <= MAX_PER_WINDOW;
}
