import type { poll, pollAudienceRule, pollOption, student } from "@/db/schema";

export const POLL_KINDS = ["quick", "seatlock"] as const;
export type PollKind = (typeof POLL_KINDS)[number];

export const QUICK_QUESTION_TYPES = [
  "single",
  "multiple",
  "yes_no",
  "short_answer",
] as const;
export type QuestionType = (typeof QUICK_QUESTION_TYPES)[number];

export const POLL_STATUSES = ["draft", "open", "closed"] as const;
export type PollStatus = (typeof POLL_STATUSES)[number];

export const AUDIENCE_MODES = ["all", "group", "custom"] as const;
export type AudienceMode = (typeof AUDIENCE_MODES)[number];

export const MANAGE_MODES = ["shared", "private"] as const;
export type ManageMode = (typeof MANAGE_MODES)[number];

export type PollRow = typeof poll.$inferSelect;
export type PollOptionRow = typeof pollOption.$inferSelect;
export type PollAudienceRuleRow = typeof pollAudienceRule.$inferSelect;
export type StudentRow = typeof student.$inferSelect;

export const KIND_LABELS: Record<PollKind, string> = {
  quick: "Quick Poll",
  seatlock: "SeatLock",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "Single choice",
  multiple: "Multiple choice",
  yes_no: "Yes / No",
  short_answer: "Short answer",
};

export const SHORT_ANSWER_MAX = 280;

// ── DTOs sent to the client ─────────────────────────────────────────────────

export interface OptionDTO {
  id: string;
  label: string;
  description: string | null;
  capacity: number | null;
  seatsTaken: number;
  position: number;
  status: "active" | "archived";
}

export interface AudienceDTO {
  mode: AudienceMode;
  rule: { batch: string; section: string | null } | null;
  /** Manager views only. */
  members?: StudentLite[];
  exclusions?: StudentLite[];
}

/** Minimal roster identity — only ever sent to roster:read holders. */
export interface StudentLite {
  id: string;
  name: string;
  usn: string;
  batch: string;
  section: string;
}

export interface PollSummaryDTO {
  id: string;
  kind: PollKind;
  questionType: QuestionType;
  title: string;
  description: string | null;
  status: PollStatus;
  closesAt: string | null;
  createdAt: string;
}

export interface ManagerPollListItem extends PollSummaryDTO {
  manageMode: ManageMode;
  audienceMode: AudienceMode;
  responseCount: number;
  optionCount: number;
  totalSeats: number | null;
  seatsTaken: number | null;
  creatorName: string | null;
  isCreator: boolean;
}

export interface ManagerPollDTO extends PollSummaryDTO {
  manageMode: ManageMode;
  showResults: boolean;
  isAnonymous: boolean;
  allowVoteChange: boolean;
  openedAt: string | null;
  closedAt: string | null;
  creatorId: string | null;
  creatorName: string | null;
  options: OptionDTO[];
  audience: AudienceDTO;
  responseCount: number;
  /** Viewer can delete, change ownership mode and manage collaborators. */
  canAdminister: boolean;
  canExport: boolean;
}

/** Aggregate results — counts only, never identities. */
export interface ResultsDTO {
  totalResponses: number;
  options: {
    id: string;
    label: string;
    count: number;
    capacity: number | null;
  }[];
  /** short_answer only: answer texts without any identity. */
  answers?: string[];
}

export interface StudentPollDTO extends PollSummaryDTO {
  /** Active options; for SeatLock includes live seat availability. */
  options: Pick<
    OptionDTO,
    "id" | "label" | "description" | "capacity" | "seatsTaken"
  >[];
  canRespond: boolean;
  /** Why the student can't respond (closed, already answered, …). */
  blockedReason: string | null;
  allowVoteChange: boolean;
  isAnonymous: boolean;
  viaGrant: boolean;
  myResponse: {
    optionIds: string[];
    textAnswer: string | null;
    submittedAt: string;
  } | null;
  results: ResultsDTO | null;
}

export function toOptionDTO(row: PollOptionRow): OptionDTO {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    capacity: row.capacity,
    seatsTaken: row.seatsTaken,
    position: row.position,
    status: row.status === "archived" ? "archived" : "active",
  };
}

export function toSummaryDTO(row: PollRow): PollSummaryDTO {
  return {
    id: row.id,
    kind: row.kind as PollKind,
    questionType: row.questionType as QuestionType,
    title: row.title,
    description: row.description,
    status: row.status as PollStatus,
    closesAt: row.closesAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toStudentLite(row: StudentRow): StudentLite {
  return {
    id: row.id,
    name: row.name,
    usn: row.usn,
    batch: row.batch,
    section: row.section,
  };
}

export function hasOptions(questionType: QuestionType): boolean {
  return questionType !== "short_answer";
}
