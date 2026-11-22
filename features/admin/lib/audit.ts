import db from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction =
  | "role.update"
  | "user.ban"
  | "user.unban"
  | "user.sessions.revoke"
  | "roster.create"
  | "roster.update"
  | "roster.delete"
  | "roster.delete_batch"
  | "roster.import"
  | "roster.export"
  | "poll.delete"
  | "poll.export"
  | "poll.grant.create"
  | "poll.grant.revoke";

export interface AuditEntry {
  actorId: string;
  action: AuditAction;
  targetType?: "user" | "student" | "poll" | "roster";
  targetId?: string | null;
  /** Ids and counts only — never names, USNs or emails. */
  details?: Record<string, unknown>;
}

/** Insert statement for an audit entry — use inside `db.batch([...])` so the
 * audit row commits atomically with the change it describes. */
export function auditInsert(entry: AuditEntry) {
  return db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    details: entry.details ?? null,
  });
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  await auditInsert(entry);
}
