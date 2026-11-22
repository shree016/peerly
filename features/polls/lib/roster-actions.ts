"use server";

import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { auditInsert, recordAudit } from "@/features/admin/lib/audit";

import { AppError, runAction } from "@/lib/app-error";
import { requirePermission } from "@/lib/permissions/server";
import { rateLimit } from "@/lib/rate-limit";

import db from "@/db";
import { student } from "@/db/schema";

import { toCsv } from "./core";
import { isPgError } from "./seat-lock";
import { type StudentLite, toStudentLite } from "./types";
import {
  type StudentInput,
  importStudentsSchema,
  studentInputSchema,
} from "./validation";

const PAGE_SIZE = 50;

export interface RosterRow extends StudentLite {
  email: string;
}

const listSchema = z.object({
  query: z.string().trim().max(60).optional(),
  batch: z.string().trim().max(20).optional(),
  section: z.string().trim().max(5).optional(),
  page: z.number().int().min(1).max(1000).default(1),
});

export async function listRoster(input: z.input<typeof listSchema>) {
  return runAction(async () => {
    await requirePermission("roster:read");
    const { query, batch, section, page } = listSchema.parse(input);
    const where = and(
      query
        ? or(
            ilike(student.name, `%${query}%`),
            ilike(student.usn, `%${query}%`),
          )
        : undefined,
      batch ? eq(student.batch, batch) : undefined,
      section ? eq(student.section, section.toUpperCase()) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      db
        .select()
        .from(student)
        .where(where)
        .orderBy(asc(student.batch), asc(student.section), asc(student.usn))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db.select({ total: count() }).from(student).where(where),
    ]);
    return {
      rows: rows.map((r): RosterRow => ({
        ...toStudentLite(r),
        email: r.email,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  });
}

export interface RosterGroup {
  batch: string;
  section: string;
  count: number;
}

export async function listRosterGroups() {
  return runAction(async (): Promise<RosterGroup[]> => {
    await requirePermission("roster:read");
    return db
      .select({
        batch: student.batch,
        section: student.section,
        count: count(),
      })
      .from(student)
      .groupBy(student.batch, student.section)
      .orderBy(sql`${student.batch} desc`, asc(student.section));
  });
}

/** Picker search for audiences / grants: min 2 chars, 20 results, rate-limited. */
export async function searchRosterStudents(query: string) {
  return runAction(async (): Promise<StudentLite[]> => {
    const user = await requirePermission("roster:read");
    const q = z.string().trim().min(2).max(60).parse(query);
    if (!rateLimit(`roster-search:${user.id}`, 40, 60_000)) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many searches — wait a moment.",
        429,
      );
    }
    const rows = await db
      .select()
      .from(student)
      .where(or(ilike(student.name, `%${q}%`), ilike(student.usn, `%${q}%`)))
      .orderBy(asc(student.usn))
      .limit(20);
    return rows.map(toStudentLite);
  });
}

function uniqueViolationMessage(error: unknown): string | null {
  if (isPgError(error, "23505", "student_usn_unique"))
    return "A student with this USN already exists.";
  if (isPgError(error, "23505", "student_email_unique"))
    return "A student with this email already exists.";
  return null;
}

export async function createStudent(input: StudentInput) {
  return runAction(async () => {
    const user = await requirePermission("roster:write");
    const data = studentInputSchema.parse(input);
    const id = crypto.randomUUID();
    try {
      await db.batch([
        db.insert(student).values({ id, ...data }),
        auditInsert({
          actorId: user.id,
          action: "roster.create",
          targetType: "student",
          targetId: id,
        }),
      ]);
    } catch (error) {
      const message = uniqueViolationMessage(error);
      if (message) throw new AppError("DUPLICATE", message, 409);
      throw error;
    }
    return { id };
  });
}

export async function updateStudent(input: { id: string; data: StudentInput }) {
  return runAction(async () => {
    const user = await requirePermission("roster:write");
    const id = z.string().min(1).parse(input.id);
    const data = studentInputSchema.parse(input.data);
    try {
      const [updated] = await db
        .update(student)
        .set(data)
        .where(eq(student.id, id))
        .returning({ id: student.id });
      if (!updated) throw new AppError("NOT_FOUND", "Student not found.", 404);
    } catch (error) {
      const message = uniqueViolationMessage(error);
      if (message) throw new AppError("DUPLICATE", message, 409);
      throw error;
    }
    await recordAudit({
      actorId: user.id,
      action: "roster.update",
      targetType: "student",
      targetId: id,
    });
    return { id };
  });
}

export async function deleteStudent(id: string) {
  return runAction(async () => {
    const user = await requirePermission("roster:write");
    const studentId = z.string().min(1).parse(id);
    await db.batch([
      db.delete(student).where(eq(student.id, studentId)),
      auditInsert({
        actorId: user.id,
        action: "roster.delete",
        targetType: "student",
        targetId: studentId,
      }),
    ]);
    return { deleted: true };
  });
}

/** Removes a whole batch (e.g. after graduation). Existing poll responses keep
 * their submission-time snapshot. */
export async function deleteBatch(batch: string) {
  return runAction(async () => {
    const user = await requirePermission("roster:write");
    const value = z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/)
      .parse(batch);
    const removed = await db
      .delete(student)
      .where(eq(student.batch, value))
      .returning({ id: student.id });
    await recordAudit({
      actorId: user.id,
      action: "roster.delete_batch",
      targetType: "roster",
      targetId: value,
      details: { removed: removed.length },
    });
    return { removed: removed.length };
  });
}

export interface ImportResult {
  created: number;
  updated: number;
  /** Row numbers (1-based, excluding header) with the reason they were skipped. */
  skipped: { row: number; reason: string }[];
}

/**
 * Upserts roster rows by USN. Rows are parsed in the browser from the
 * uploaded CSV/JSON and sent straight here — the file itself is never stored.
 */
export async function importStudents(input: {
  rows: Record<string, unknown>[];
}) {
  return runAction(async (): Promise<ImportResult> => {
    const user = await requirePermission("roster:write");
    const { rows } = importStudentsSchema.parse(input);

    const skipped: ImportResult["skipped"] = [];
    const valid = new Map<string, z.infer<typeof studentInputSchema>>();
    const rowOf = new Map<string, number>();
    const seenEmails = new Map<string, string>();

    rows.forEach((raw, i) => {
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [
          k.trim().toLowerCase(),
          typeof v === "string" ? v : String(v ?? ""),
        ]),
      );
      const parsed = studentInputSchema.safeParse(normalized);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        skipped.push({
          row: i + 1,
          reason: `${issue?.path.join(".") || "row"}: ${issue?.message ?? "invalid"}`,
        });
        return;
      }
      const owner = seenEmails.get(parsed.data.email);
      if (owner && owner !== parsed.data.usn) {
        skipped.push({
          row: i + 1,
          reason: "email: used by another row in this file",
        });
        return;
      }
      seenEmails.set(parsed.data.email, parsed.data.usn);
      valid.set(parsed.data.usn, parsed.data);
      rowOf.set(parsed.data.usn, i + 1);
    });

    const list = [...valid.values()];
    if (list.length === 0) return { created: 0, updated: 0, skipped };

    // Emails already used by a *different* USN would violate the unique
    // constraint and abort the whole batch — skip those rows up front.
    const existing = await db
      .select({ usn: student.usn, email: student.email })
      .from(student)
      .where(
        or(
          inArray(
            student.usn,
            list.map((s) => s.usn),
          ),
          inArray(
            student.email,
            list.map((s) => s.email),
          ),
        ),
      );
    const usnByEmail = new Map(existing.map((e) => [e.email, e.usn]));
    const existingUsns = new Set(existing.map((e) => e.usn));
    const toWrite = list.filter((s) => {
      const holder = usnByEmail.get(s.email);
      if (holder && holder !== s.usn) {
        skipped.push({
          row: rowOf.get(s.usn) ?? 0,
          reason: "email: already used by another student",
        });
        return false;
      }
      return true;
    });

    let created = 0;
    let updated = 0;
    for (let i = 0; i < toWrite.length; i += 500) {
      const chunk = toWrite.slice(i, i + 500);
      await db
        .insert(student)
        .values(chunk)
        .onConflictDoUpdate({
          target: student.usn,
          set: {
            name: sql`excluded.name`,
            email: sql`excluded.email`,
            batch: sql`excluded.batch`,
            section: sql`excluded.section`,
            updatedAt: new Date(),
          },
        });
      for (const s of chunk) {
        if (existingUsns.has(s.usn)) updated++;
        else created++;
      }
    }

    await recordAudit({
      actorId: user.id,
      action: "roster.import",
      targetType: "roster",
      details: { created, updated, skipped: skipped.length },
    });
    return { created, updated, skipped: skipped.sort((a, b) => a.row - b.row) };
  });
}

export async function exportRosterCsv(batch?: string | null) {
  return runAction(async () => {
    const user = await requirePermission("roster:export");
    const value = batch ? z.string().trim().max(20).parse(batch) : null;
    const rows = await db
      .select()
      .from(student)
      .where(value ? eq(student.batch, value) : undefined)
      .orderBy(asc(student.batch), asc(student.section), asc(student.usn));
    await recordAudit({
      actorId: user.id,
      action: "roster.export",
      targetType: "roster",
      targetId: value,
      details: { rows: rows.length },
    });
    return {
      filename: `roster${value ? `-${value}` : ""}.csv`,
      csv: toCsv(
        ["name", "usn", "email", "batch", "section"],
        rows.map((r) => [r.name, r.usn, r.email, r.batch, r.section]),
      ),
    };
  });
}
