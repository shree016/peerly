"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { isPgError } from "@/features/polls/lib/seat-lock";

import { AppError, runAction } from "@/lib/app-error";
import { requirePermission } from "@/lib/permissions/server";
import { isExperienceUploadUrl } from "@/lib/s3/storage";

import db from "@/db";
import { experienceTemplate } from "@/db/schema";

import {
  driveKey,
  loadCommunityTemplates,
  loadOfficialTemplates,
} from "./templates";
import type { ExperienceTemplate, ManagedDriveTemplate } from "./types";
import { difficultyOptions, roundTypeOptions } from "./validation";

const DUPLICATE_INDEX = "experience_template_drive_active_unique";

const driveTemplateSchema = z.object({
  id: z.string().min(1).optional(),
  companyName: z.string().trim().min(2, "Company name is required").max(100),
  companyLogoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((url) => !url || isExperienceUploadUrl(url, "logos"), {
      message: "Remove the logo and upload it again.",
    })
    .nullable()
    .optional(),
  role: z.string().trim().min(2, "Role is required").max(100),
  batch: z.string().trim().min(1, "Batch is required").max(20),
  ctcLpa: z.number().min(0).max(200).nullable().optional(),
  jd: z
    .object({
      url: z
        .string()
        .trim()
        .min(1)
        .max(1000)
        .refine((url) => isExperienceUploadUrl(url, "documents"), {
          message: "Remove the job description and upload it again.",
        }),
      fileName: z.string().trim().min(1).max(255),
    })
    .nullable()
    .optional(),
  rounds: z
    .array(
      z.object({
        roundType: z.enum(roundTypeOptions),
        difficulty: z.enum(difficultyOptions).nullable().optional(),
      }),
    )
    .min(1, "Add at least one round")
    .max(15, "A drive template can have at most 15 rounds"),
});

export type DriveTemplateInput = z.input<typeof driveTemplateSchema>;

export interface DriveTemplatesOverview {
  official: ManagedDriveTemplate[];
  /** Drives students have posted about that have no official template yet. */
  suggestions: ExperienceTemplate[];
}

export async function listDriveTemplates() {
  return runAction(async (): Promise<DriveTemplatesOverview> => {
    await requirePermission("experience:templates");
    const [official, community] = await Promise.all([
      loadOfficialTemplates({ includeArchived: true }),
      loadCommunityTemplates(),
    ]);
    const activeKeys = new Set(
      official.filter((t) => t.status === "active").map((t) => t.key),
    );
    for (const t of official) {
      const posts = community.get(t.key);
      if (posts) {
        t.postCount = posts.postCount;
        t.lastSharedAt = posts.lastSharedAt;
      }
    }
    const suggestions = [...community.values()]
      .filter((t) => !activeKeys.has(t.key))
      .sort((a, b) => b.postCount - a.postCount);
    return { official, suggestions };
  });
}

function duplicateError(): AppError {
  return new AppError(
    "DUPLICATE_TEMPLATE",
    "There's already an active template for this company, role and batch.",
    409,
  );
}

export async function saveDriveTemplate(input: DriveTemplateInput) {
  return runAction(async () => {
    const user = await requirePermission("experience:templates");
    const data = driveTemplateSchema.parse(input);

    const values = {
      companyName: data.companyName,
      companyLogoUrl: data.companyLogoUrl || null,
      role: data.role,
      batch: data.batch,
      ctcLpa: data.ctcLpa ?? null,
      jdUrl: data.jd?.url ?? null,
      jdFileName: data.jd?.fileName ?? null,
      rounds: data.rounds.map((r) => ({
        roundType: r.roundType,
        difficulty: r.difficulty ?? null,
      })),
      updatedBy: user.id,
    };

    try {
      if (data.id) {
        const [updated] = await db
          .update(experienceTemplate)
          .set(values)
          .where(eq(experienceTemplate.id, data.id))
          .returning({ id: experienceTemplate.id });
        if (!updated) {
          throw new AppError("NOT_FOUND", "Template not found.", 404);
        }
        return { id: updated.id };
      }
      const [created] = await db
        .insert(experienceTemplate)
        .values({ ...values, createdBy: user.id })
        .returning({ id: experienceTemplate.id });
      return { id: created.id };
    } catch (error) {
      if (isPgError(error, "23505", DUPLICATE_INDEX)) throw duplicateError();
      throw error;
    }
  });
}

export async function setDriveTemplateStatus(input: {
  id: string;
  status: "active" | "archived";
}) {
  return runAction(async () => {
    const user = await requirePermission("experience:templates");
    const { id, status } = z
      .object({ id: z.string().min(1), status: z.enum(["active", "archived"]) })
      .parse(input);

    const row = await db.query.experienceTemplate.findFirst({
      where: eq(experienceTemplate.id, id),
    });
    if (!row) throw new AppError("NOT_FOUND", "Template not found.", 404);

    if (status === "active") {
      // Restoring must not clash with another active template for the drive.
      const clash = await db
        .select({ id: experienceTemplate.id })
        .from(experienceTemplate)
        .where(
          and(
            ne(experienceTemplate.id, id),
            eq(experienceTemplate.status, "active"),
            sql`lower(${experienceTemplate.companyName}) = lower(${row.companyName})`,
            sql`lower(${experienceTemplate.role}) = lower(${row.role})`,
            sql`lower(${experienceTemplate.batch}) = lower(${row.batch})`,
          ),
        )
        .limit(1);
      if (clash.length) throw duplicateError();
    }

    try {
      await db
        .update(experienceTemplate)
        .set({ status, updatedBy: user.id })
        .where(eq(experienceTemplate.id, id));
    } catch (error) {
      if (isPgError(error, "23505", DUPLICATE_INDEX)) throw duplicateError();
      throw error;
    }
    return { id, status, key: driveKey(row.companyName, row.role, row.batch) };
  });
}

export async function deleteDriveTemplate(id: string) {
  return runAction(async () => {
    await requirePermission("experience:templates");
    const templateId = z.string().min(1).parse(id);
    // Experiences only ever copied values out of the template, so deleting it
    // never changes anything already posted. Uploaded JD/logo files are kept
    // because experiences that started from this template may still use them.
    const [removed] = await db
      .delete(experienceTemplate)
      .where(eq(experienceTemplate.id, templateId))
      .returning({ id: experienceTemplate.id });
    if (!removed) throw new AppError("NOT_FOUND", "Template not found.", 404);
    return { deleted: true };
  });
}
