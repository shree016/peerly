// Server-only helpers for drive templates (not a "use server" module, so
// nothing here is callable from the browser). Used by the student form
// (getExperienceTemplates) and the coordinator page (template-actions).
import { asc, desc, eq } from "drizzle-orm";

import db from "@/db";
import { experienceTemplate, interviewExperience } from "@/db/schema";

import type { ExperienceTemplate, ManagedDriveTemplate } from "./types";
import {
  type RoundType,
  difficultyOptions,
  roundTypeOptions,
} from "./validation";

type TemplateRound = ExperienceTemplate["rounds"][number];
type Difficulty = TemplateRound["difficulty"];

const knownRoundTypes = new Set<string>(roundTypeOptions);
const knownDifficulties = new Set<string>(difficultyOptions);

/** Same drive = same company + role + batch, ignoring case and spacing. */
export function driveKey(companyName: string, role: string, batch: string) {
  return [companyName, role, batch]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

function cleanRounds(
  rounds: { roundType: string; difficulty: string | null }[],
): TemplateRound[] {
  return rounds
    .filter((r) => knownRoundTypes.has(r.roundType))
    .map((r) => ({
      roundType: r.roundType as RoundType,
      difficulty:
        r.difficulty && knownDifficulties.has(r.difficulty)
          ? (r.difficulty as Difficulty)
          : undefined,
    }));
}

/** Templates derived from students' published experiences, keyed by drive. */
export async function loadCommunityTemplates(): Promise<
  Map<string, ExperienceTemplate>
> {
  const rows = await db.query.interviewExperience.findMany({
    where: eq(interviewExperience.isPublished, true),
    orderBy: (e) => [desc(e.createdAt)],
    columns: {
      id: true,
      companyName: true,
      companyLogoUrl: true,
      role: true,
      batch: true,
      ctcLpa: true,
      jdUrl: true,
      jdFileName: true,
      createdAt: true,
    },
    with: {
      rounds: {
        orderBy: (r) => [asc(r.roundNumber)],
        columns: { roundType: true, difficulty: true },
      },
    },
  });

  const templates = new Map<string, ExperienceTemplate>();

  // Rows arrive newest first, so the first non-empty value seen for a field is
  // the most recent one anyone recorded for that drive.
  for (const row of rows) {
    const key = driveKey(row.companyName, row.role, row.batch);
    const rounds = cleanRounds(row.rounds);

    const existing = templates.get(key);
    if (!existing) {
      templates.set(key, {
        key,
        source: "community",
        companyName: row.companyName.trim(),
        companyLogoUrl: row.companyLogoUrl,
        role: row.role.trim(),
        batch: row.batch.trim(),
        ctcLpa: row.ctcLpa,
        jd: row.jdUrl
          ? { url: row.jdUrl, fileName: row.jdFileName ?? "Job description" }
          : null,
        rounds,
        postCount: 1,
        lastSharedAt: row.createdAt,
      });
      continue;
    }

    existing.postCount += 1;
    existing.companyLogoUrl ??= row.companyLogoUrl;
    existing.ctcLpa ??= row.ctcLpa;
    if (!existing.jd && row.jdUrl) {
      existing.jd = {
        url: row.jdUrl,
        fileName: row.jdFileName ?? "Job description",
      };
    }
    // Someone rejected early only saw part of the process; the longest round
    // list is the closest to the drive's full structure.
    if (rounds.length > existing.rounds.length) existing.rounds = rounds;
  }

  return templates;
}

/** Official templates written by placement coordinators. */
export async function loadOfficialTemplates(opts: {
  includeArchived: boolean;
}): Promise<ManagedDriveTemplate[]> {
  const rows = await db.query.experienceTemplate.findMany({
    where: opts.includeArchived
      ? undefined
      : eq(experienceTemplate.status, "active"),
    orderBy: [
      asc(experienceTemplate.companyName),
      asc(experienceTemplate.role),
    ],
    with: { creator: { columns: { name: true } } },
  });

  return rows.map((row) => ({
    key: driveKey(row.companyName, row.role, row.batch),
    source: "official" as const,
    templateId: row.id,
    status: row.status === "archived" ? "archived" : "active",
    companyName: row.companyName,
    companyLogoUrl: row.companyLogoUrl,
    role: row.role,
    batch: row.batch,
    ctcLpa: row.ctcLpa,
    jd: row.jdUrl
      ? { url: row.jdUrl, fileName: row.jdFileName ?? "Job description" }
      : null,
    rounds: cleanRounds(row.rounds ?? []),
    postCount: 0,
    lastSharedAt: null,
    createdByName: row.creator?.name ?? null,
    updatedAt: row.updatedAt,
  }));
}

/**
 * What students see in the "Start from a template" picker: official
 * templates first, then community ones for drives that have no official
 * template yet. An official template also shows how many posts exist for it.
 */
export async function loadTemplatesForStudents(): Promise<
  ExperienceTemplate[]
> {
  const [official, community] = await Promise.all([
    loadOfficialTemplates({ includeArchived: false }),
    loadCommunityTemplates(),
  ]);

  const officialKeys = new Set(official.map((t) => t.key));
  const merged: ExperienceTemplate[] = official.map((t) => {
    const posts = community.get(t.key);
    return {
      key: t.key,
      source: "official",
      templateId: t.templateId,
      companyName: t.companyName,
      companyLogoUrl: t.companyLogoUrl ?? posts?.companyLogoUrl ?? null,
      role: t.role,
      batch: t.batch,
      ctcLpa: t.ctcLpa,
      jd: t.jd,
      rounds: t.rounds,
      postCount: posts?.postCount ?? 0,
      lastSharedAt: posts?.lastSharedAt ?? null,
    };
  });

  for (const [key, template] of community) {
    if (!officialKeys.has(key)) merged.push(template);
  }
  return merged;
}
