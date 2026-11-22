import { z } from "zod";

import {
  AUDIENCE_MODES,
  MANAGE_MODES,
  POLL_KINDS,
  QUICK_QUESTION_TYPES,
  SHORT_ANSWER_MAX,
} from "./types";

const id = z.string().trim().min(1).max(64);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const closesAt = z
  .string()
  .datetime({ offset: true })
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(v) : null));

export const optionInputSchema = z.object({
  label: z.string().trim().min(1, "Option label is required.").max(120),
  description: optionalText(300),
  capacity: z.number().int().min(1).max(10_000).optional().nullable(),
});
export type OptionInput = z.infer<typeof optionInputSchema>;

export const createPollSchema = z
  .object({
    kind: z.enum(POLL_KINDS),
    questionType: z.enum(QUICK_QUESTION_TYPES).default("single"),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters.")
      .max(160),
    description: optionalText(1000),
    closesAt,
    manageMode: z.enum(MANAGE_MODES).default("shared"),
    showResults: z.boolean().default(false),
    isAnonymous: z.boolean().default(false),
    allowVoteChange: z.boolean().default(true),
    options: z.array(optionInputSchema).max(50).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "seatlock") {
      data.options.forEach((o, i) => {
        if (!o.capacity) {
          ctx.addIssue({
            code: "custom",
            message: "Every SeatLock option needs a seat count.",
            path: ["options", i, "capacity"],
          });
        }
      });
    }
  });
export type CreatePollInput = z.input<typeof createPollSchema>;

export const updatePollSchema = z.object({
  pollId: id,
  title: z.string().trim().min(3).max(160).optional(),
  description: optionalText(1000),
  closesAt: closesAt.optional(),
  manageMode: z.enum(MANAGE_MODES).optional(),
  showResults: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
  allowVoteChange: z.boolean().optional(),
});
export type UpdatePollInput = z.input<typeof updatePollSchema>;

export const setStatusSchema = z.object({
  pollId: id,
  status: z.enum(["open", "closed"]),
});

export const addOptionSchema = optionInputSchema.extend({ pollId: id });

export const updateOptionSchema = z.object({
  pollId: id,
  optionId: id,
  label: z.string().trim().min(1).max(120).optional(),
  description: optionalText(300),
  capacity: z.number().int().min(1).max(10_000).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const moveOptionSchema = z.object({
  pollId: id,
  optionId: id,
  direction: z.enum(["up", "down"]),
});

export const setAudienceSchema = z
  .object({
    pollId: id,
    mode: z.enum(AUDIENCE_MODES),
    batch: z.string().trim().max(20).optional().nullable(),
    section: z.string().trim().max(10).optional().nullable(),
    studentIds: z.array(id).max(2000).default([]),
    excludedStudentIds: z.array(id).max(2000).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.mode === "group" && !d.batch) {
      ctx.addIssue({
        code: "custom",
        message: "Pick a batch.",
        path: ["batch"],
      });
    }
    if (d.mode === "custom" && d.studentIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one student.",
        path: ["studentIds"],
      });
    }
  });
export type SetAudienceInput = z.input<typeof setAudienceSchema>;

export const submitResponseSchema = z.object({
  pollId: id,
  optionIds: z.array(id).max(50).default([]),
  textAnswer: z.string().trim().max(SHORT_ANSWER_MAX).optional().nullable(),
});
export type SubmitResponseInput = z.input<typeof submitResponseSchema>;

export const grantSchema = z.object({
  pollId: id,
  studentIds: z.array(id).min(1).max(200),
  remarks: z.string().trim().min(3, "Add a short reason.").max(300),
});

export const inviteSchema = z.object({
  pollId: id,
  userIds: z.array(id).min(1).max(20),
});

// ── Roster ──────────────────────────────────────────────────────────────────

export const studentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  usn: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "USN can only contain letters and numbers.")
    .transform((v) => v.toUpperCase()),
  email: z
    .string()
    .trim()
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  batch: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, "Batch looks like 2025-27."),
  section: z
    .string()
    .trim()
    .min(1)
    .max(5)
    .transform((v) => v.toUpperCase()),
});
export type StudentInput = z.input<typeof studentInputSchema>;

export const importStudentsSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(3000),
});
