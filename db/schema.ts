/**
 * Peeerly database schema.
 *
 * Tables: auth (user/session/account/verification), Placement Experiences
 * (interview_experience*), Quiz (quiz_*), and quiz course materials for
 * grounded AI question generation (quiz_event_material*, quiz_question_source_citation).
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// User Table
export const user = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  github: text("github"),
  twitter: text("twitter"),
  peerlist: text("peerlist"),
  linkedin: text("linkedin"),
  portfolio: text("portfolio"),
  bio: text("bio"),
  // RBAC (Better Auth admin plugin). Comma-separated role names, e.g.
  // "placement_coordinator,activity_coordinator". Role → permission mapping
  // lives in code (lib/permissions/roles.ts); assignments are changed only
  // through the audited actions in features/admin.
  role: text("role").default("student"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  currentVideoNumber: integer("currentVideoNumber"),
  currentVideoLink: text("currentVideoLink"),
});

// Session Table
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .$onUpdate(() => new Date()),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Required by the Better Auth admin plugin schema. Impersonation endpoints
  // are blocked in lib/auth.ts, so this stays null.
  impersonatedBy: text("impersonatedBy"),
});

// Account Table
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .$onUpdate(() => new Date()),
});

// Verification Table
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});


// InterviewExperience Table (seniors sharing placement writeups — covers the
// whole process: aptitude, OA, coding, interviews. Table names kept as
// "interview_experience*" for continuity with existing prod data; the feature
// is surfaced to users as "Placement Experiences".)
export const interviewExperience = pgTable("interview_experience", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  authorId: text("author_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Optional placement drive reference (plain nullable column, no FK).
  driveId: text("drive_id"),
  companyName: text("company_name").notNull(),
  // Optional company logo uploaded to S3. Null falls back to the generated
  // gradient-and-initial tile from company-color.ts.
  companyLogoUrl: text("company_logo_url"),
  role: text("role").notNull(),
  batch: text("batch").notNull(),
  result: text("result").notNull(), // "Selected" | "Rejected" | "Waitlisted"
  ctcLpa: real("ctc_lpa"),
  overview: text("overview").notNull(),
  preparationResources: text("preparation_resources"),
  // Job description document (PDF/DOCX) uploaded to S3. jdFileName keeps the
  // uploader's original filename so downloads land with a readable name
  // instead of the UUID the S3 key uses.
  jdUrl: text("jd_url"),
  jdFileName: text("jd_file_name"),
  isPublished: boolean("is_published").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedBy: text("verified_by").references(() => user.id, {
    onDelete: "set null",
  }),
  verifiedAt: timestamp("verified_at", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// InterviewExperienceRound Table
export const interviewExperienceRound = pgTable(
  "interview_experience_round",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    experienceId: text("experience_id")
      .notNull()
      .references(() => interviewExperience.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    roundType: text("round_type").notNull(), // "Aptitude" | "OA" | "Coding" | "Technical" | "System Design" | "GD" | "Managerial" | "HR" | "Assignment" | "Other"
    description: text("description").notNull(),
    difficulty: text("difficulty"), // "Easy" | "Medium" | "Hard"
    // Did the candidate clear this round? "Cleared" | "Not Cleared" |
    // "Awaiting Result". Nullable because rounds written before this column
    // existed have no recorded outcome.
    outcome: text("outcome"),
  },
  (t) => [
    index("interview_experience_round_experience_idx").on(t.experienceId),
  ],
);

// InterviewExperienceResource Table (extra resources attached to an
// experience — PDF/DOCX documents uploaded to S3, each with its own name)
export const interviewExperienceResource = pgTable(
  "interview_experience_resource",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    experienceId: text("experience_id")
      .notNull()
      .references(() => interviewExperience.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "pdf" | "docx"
    // Author-supplied display name — required, so every resource is
    // identifiable without opening it.
    title: text("title").notNull(),
    content: text("content").notNull(), // S3 URL of the uploaded document
    fileName: text("file_name"), // original upload filename, used for downloads
    fileSize: integer("file_size"), // bytes, for the "2.4 MB" hint in the UI
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("interview_experience_resource_experience_idx").on(t.experienceId),
  ],
);

// InterviewExperienceComment Table (ask-the-senior Q&A thread per experience)
export const interviewExperienceComment = pgTable(
  "interview_experience_comment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    experienceId: text("experience_id")
      .notNull()
      .references(() => interviewExperience.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("interview_experience_comment_experience_idx").on(t.experienceId),
  ],
);

// Quiz Event Table
export const quizEvent = pgTable(
  "quiz_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    adminId: text("admin_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"),
    joinCode: text("join_code").unique(),
    logoUrl: text("logo_url"),
    themeId: text("theme_id").notNull().default("ocean"),
    customTheme: jsonb("custom_theme"),
    anonymousMode: boolean("anonymous_mode").notNull().default(false),
    autoPlayMode: boolean("auto_play_mode").notNull().default(false),
    enforceFocusMode: boolean("enforce_focus_mode").notNull().default(true),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("quiz_events_admin_title_unique").on(
      t.adminId,
      sql`lower(${t.title})`,
    ),
  ],
);

// Quiz Question Table
export const quizQuestion = pgTable(
  "quiz_question",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id")
      .notNull()
      .references(() => quizEvent.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionType: text("question_type").notNull(),
    text: text("text").notNull(),
    imageUrl: text("image_url"),
    timeLimit: integer("time_limit").notNull().default(20),
    ratingMin: integer("rating_min"),
    ratingMax: integer("rating_max"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("quiz_questions_event_position").on(t.eventId, t.position)],
);

// Quiz Answer Option Table
export const quizAnswerOption = pgTable(
  "quiz_answer_option",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text"),
    imageUrl: text("image_url"),
    isCorrect: boolean("is_correct").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("quiz_answer_options_question_position").on(
      t.questionId,
      t.position,
    ),
  ],
);

// Quiz Session Table
export const quizSession = pgTable("quiz_session", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => quizEvent.id, { onDelete: "cascade" }),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull().default("lobby"),
  currentQuestionId: text("current_question_id").references(
    () => quizQuestion.id,
    { onDelete: "set null" },
  ),
  currentQuestionIndex: integer("current_question_index"),
  questionStartedAt: timestamp("question_started_at", { mode: "date" }),
  participantCount: integer("participant_count").notNull().default(0),
  startedAt: timestamp("started_at", { mode: "date" }),
  endedAt: timestamp("ended_at", { mode: "date" }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// Quiz Session Participant Table
export const quizSessionParticipant = pgTable(
  "quiz_session_participant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => quizSession.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    avatar: text("avatar").notNull(),
    totalScore: integer("total_score").notNull().default(0),
    rank: integer("rank"),
    isConnected: boolean("is_connected").notNull().default(true),
    disconnectedAt: timestamp("disconnected_at", { mode: "date" }),
    // Set when a participant is removed mid-quiz (focus-mode violation or by
    // the host). The row and its answers are kept so analytics stay complete;
    // removed participants are excluded from live counts and leaderboards.
    removedAt: timestamp("removed_at", { mode: "date" }),
    // "focus_violation" | "host"
    removalReason: text("removal_reason"),
    participantToken: text("participant_token").notNull().unique(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("quiz_session_participants_session_display_name").on(
      t.sessionId,
      t.displayName,
    ),
  ],
);

// Quiz Participant Answer Table
export const quizParticipantAnswer = pgTable(
  "quiz_participant_answer",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => quizSession.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => quizSessionParticipant.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    selectedOptionIds: text("selected_option_ids").array(),
    openTextResponse: text("open_text_response"),
    ratingValue: integer("rating_value"),
    isCorrect: boolean("is_correct"),
    scoreAwarded: integer("score_awarded").notNull().default(0),
    responseTimeMs: integer("response_time_ms"),
    submittedAt: timestamp("submitted_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("quiz_participant_answers_participant_question").on(
      t.participantId,
      t.questionId,
    ),
  ],
);

// Quiz Analytics Snapshot Table
export const quizAnalyticsSnapshot = pgTable(
  "quiz_analytics_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => quizSession.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    totalResponses: integer("total_responses").notNull().default(0),
    optionCounts: jsonb("option_counts").notNull().default({}),
    avgResponseTimeMs: integer("avg_response_time_ms"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("quiz_analytics_snapshots_session_question").on(
      t.sessionId,
      t.questionId,
    ),
  ],
);

// Cached AI feedback for one participant report (deterministic data is computed on read)
export const quizParticipantReport = pgTable(
  "quiz_participant_report",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => quizSession.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => quizSessionParticipant.id, { onDelete: "cascade" }),
    aiStatus: text("ai_status").notNull().default("idle"),
    aiFeedback: jsonb("ai_feedback"),
    aiError: text("ai_error"),
    pdfStatus: text("pdf_status").notNull().default("idle"),
    pdfS3Key: text("pdf_s3_key"),
    pdfContentHash: text("pdf_content_hash"),
    pdfError: text("pdf_error"),
    pdfGeneratedAt: timestamp("pdf_generated_at", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("quiz_participant_reports_participant").on(t.participantId),
  ],
);

export const quizSessionReportFeedback = pgTable(
  "quiz_session_report_feedback",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text("session_id")
      .notNull()
      .references(() => quizSession.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => quizSessionParticipant.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    rating: integer("rating").notNull(),
    feedbackText: text("feedback_text").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("quiz_session_report_feedback_participant").on(
      t.sessionId,
      t.participantId,
    ),
  ],
);

// Quiz Join Code History Table
export const quizJoinCodeHistory = pgTable("quiz_join_code_history", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => quizEvent.id, { onDelete: "cascade" }),
  joinCode: text("join_code").notNull(),
  issuedAt: timestamp("issued_at", { mode: "date" }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { mode: "date" }),
});


// ─── Quiz course materials (RAG) ─────────────────────────────────────────────
// Admin-uploaded PDF/DOCX/PPTX per quiz event, split into chunks with OpenAI
// embeddings so AI question generation can be grounded in the material.
// Embeddings are stored as jsonb number[] and ranked in Node (no pgvector).
export const quizEventMaterial = pgTable("quiz_event_material", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id")
    .notNull()
    .references(() => quizEvent.id, { onDelete: "cascade" }),
  adminId: text("admin_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  s3Key: text("s3_key").notNull(),
  status: text("status").notNull().default("pending"), // pending | indexing | ready | failed
  error: text("error"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const quizEventMaterialChunk = pgTable(
  "quiz_event_material_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    materialId: text("material_id")
      .notNull()
      .references(() => quizEventMaterial.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .notNull()
      .references(() => quizEvent.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    pageNumber: integer("page_number"),
    slideNumber: integer("slide_number"),
    text: text("text").notNull(),
    embedding: jsonb("embedding").$type<number[]>(),
    tokenCount: integer("token_count"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("quiz_event_material_chunk_material_index").on(
      t.materialId,
      t.chunkIndex,
    ),
    index("quiz_event_material_chunk_event_idx").on(t.eventId),
  ],
);

export const quizQuestionSourceCitation = pgTable(
  "quiz_question_source_citation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestion.id, { onDelete: "cascade" }),
    materialId: text("material_id")
      .notNull()
      .references(() => quizEventMaterial.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    pageNumber: integer("page_number"),
    slideNumber: integer("slide_number"),
    excerpt: text("excerpt").notNull(),
    chunkId: text("chunk_id").references(() => quizEventMaterialChunk.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("quiz_question_source_citation_question_idx").on(t.questionId)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  quizEvents: many(quizEvent),
  quizSessions: many(quizSession),
  interviewExperiences: many(interviewExperience),
  interviewExperienceComments: many(interviewExperienceComment),
  polls: many(poll),
  pollResponses: many(pollResponse),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const interviewExperienceRelations = relations(
  interviewExperience,
  ({ one, many }) => ({
    author: one(user, {
      fields: [interviewExperience.authorId],
      references: [user.id],
    }),
    rounds: many(interviewExperienceRound),
    resources: many(interviewExperienceResource),
    comments: many(interviewExperienceComment),
  }),
);

export const interviewExperienceRoundRelations = relations(
  interviewExperienceRound,
  ({ one }) => ({
    experience: one(interviewExperience, {
      fields: [interviewExperienceRound.experienceId],
      references: [interviewExperience.id],
    }),
  }),
);

export const interviewExperienceResourceRelations = relations(
  interviewExperienceResource,
  ({ one }) => ({
    experience: one(interviewExperience, {
      fields: [interviewExperienceResource.experienceId],
      references: [interviewExperience.id],
    }),
  }),
);

export const interviewExperienceCommentRelations = relations(
  interviewExperienceComment,
  ({ one }) => ({
    experience: one(interviewExperience, {
      fields: [interviewExperienceComment.experienceId],
      references: [interviewExperience.id],
    }),
    author: one(user, {
      fields: [interviewExperienceComment.authorId],
      references: [user.id],
    }),
  }),
);

export const quizEventRelations = relations(quizEvent, ({ one, many }) => ({
  admin: one(user, {
    fields: [quizEvent.adminId],
    references: [user.id],
  }),
  questions: many(quizQuestion),
  sessions: many(quizSession),
  joinCodeHistory: many(quizJoinCodeHistory),
  materials: many(quizEventMaterial),
}));

export const quizQuestionRelations = relations(
  quizQuestion,
  ({ one, many }) => ({
    event: one(quizEvent, {
      fields: [quizQuestion.eventId],
      references: [quizEvent.id],
    }),
    answerOptions: many(quizAnswerOption),
    participantAnswers: many(quizParticipantAnswer),
    analyticsSnapshots: many(quizAnalyticsSnapshot),
    currentSessions: many(quizSession),
    sourceCitations: many(quizQuestionSourceCitation),
  }),
);

export const quizAnswerOptionRelations = relations(
  quizAnswerOption,
  ({ one }) => ({
    question: one(quizQuestion, {
      fields: [quizAnswerOption.questionId],
      references: [quizQuestion.id],
    }),
  }),
);

export const quizSessionRelations = relations(quizSession, ({ one, many }) => ({
  event: one(quizEvent, {
    fields: [quizSession.eventId],
    references: [quizEvent.id],
  }),
  admin: one(user, {
    fields: [quizSession.adminId],
    references: [user.id],
  }),
  currentQuestion: one(quizQuestion, {
    fields: [quizSession.currentQuestionId],
    references: [quizQuestion.id],
  }),
  participants: many(quizSessionParticipant),
  answers: many(quizParticipantAnswer),
  analyticsSnapshots: many(quizAnalyticsSnapshot),
  participantReports: many(quizParticipantReport),
  reportFeedback: many(quizSessionReportFeedback),
}));

export const quizSessionParticipantRelations = relations(
  quizSessionParticipant,
  ({ one, many }) => ({
    session: one(quizSession, {
      fields: [quizSessionParticipant.sessionId],
      references: [quizSession.id],
    }),
    answers: many(quizParticipantAnswer),
    report: one(quizParticipantReport),
  }),
);

export const quizParticipantReportRelations = relations(
  quizParticipantReport,
  ({ one }) => ({
    session: one(quizSession, {
      fields: [quizParticipantReport.sessionId],
      references: [quizSession.id],
    }),
    participant: one(quizSessionParticipant, {
      fields: [quizParticipantReport.participantId],
      references: [quizSessionParticipant.id],
    }),
  }),
);

export const quizSessionReportFeedbackRelations = relations(
  quizSessionReportFeedback,
  ({ one }) => ({
    session: one(quizSession, {
      fields: [quizSessionReportFeedback.sessionId],
      references: [quizSession.id],
    }),
    participant: one(quizSessionParticipant, {
      fields: [quizSessionReportFeedback.participantId],
      references: [quizSessionParticipant.id],
    }),
  }),
);

export const quizParticipantAnswerRelations = relations(
  quizParticipantAnswer,
  ({ one }) => ({
    session: one(quizSession, {
      fields: [quizParticipantAnswer.sessionId],
      references: [quizSession.id],
    }),
    participant: one(quizSessionParticipant, {
      fields: [quizParticipantAnswer.participantId],
      references: [quizSessionParticipant.id],
    }),
    question: one(quizQuestion, {
      fields: [quizParticipantAnswer.questionId],
      references: [quizQuestion.id],
    }),
  }),
);

export const quizAnalyticsSnapshotRelations = relations(
  quizAnalyticsSnapshot,
  ({ one }) => ({
    session: one(quizSession, {
      fields: [quizAnalyticsSnapshot.sessionId],
      references: [quizSession.id],
    }),
    question: one(quizQuestion, {
      fields: [quizAnalyticsSnapshot.questionId],
      references: [quizQuestion.id],
    }),
  }),
);

export const quizJoinCodeHistoryRelations = relations(
  quizJoinCodeHistory,
  ({ one }) => ({
    event: one(quizEvent, {
      fields: [quizJoinCodeHistory.eventId],
      references: [quizEvent.id],
    }),
  }),
);

export const quizEventMaterialRelations = relations(
  quizEventMaterial,
  ({ one, many }) => ({
    event: one(quizEvent, {
      fields: [quizEventMaterial.eventId],
      references: [quizEvent.id],
    }),
    admin: one(user, {
      fields: [quizEventMaterial.adminId],
      references: [user.id],
    }),
    chunks: many(quizEventMaterialChunk),
  }),
);

export const quizEventMaterialChunkRelations = relations(
  quizEventMaterialChunk,
  ({ one }) => ({
    material: one(quizEventMaterial, {
      fields: [quizEventMaterialChunk.materialId],
      references: [quizEventMaterial.id],
    }),
    event: one(quizEvent, {
      fields: [quizEventMaterialChunk.eventId],
      references: [quizEvent.id],
    }),
  }),
);

export const quizQuestionSourceCitationRelations = relations(
  quizQuestionSourceCitation,
  ({ one }) => ({
    question: one(quizQuestion, {
      fields: [quizQuestionSourceCitation.questionId],
      references: [quizQuestion.id],
    }),
    material: one(quizEventMaterial, {
      fields: [quizQuestionSourceCitation.materialId],
      references: [quizEventMaterial.id],
    }),
    chunk: one(quizEventMaterialChunk, {
      fields: [quizQuestionSourceCitation.chunkId],
      references: [quizEventMaterialChunk.id],
    }),
  }),
);

// ════════════════════════════════════════════════════════════════════════════
// RBAC audit log
// ════════════════════════════════════════════════════════════════════════════

// Append-only record of every sensitive action: role changes, bans, session
// revocations, roster imports/edits/deletes and any export of personal data.
// `details` must hold ids/counts only — never student names, USNs or emails.
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(), // e.g. 'role.update', 'roster.import'
    targetType: text("target_type"), // 'user' | 'student' | 'poll' | 'roster'
    targetId: text("target_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    index("audit_log_actor_id_idx").on(t.actorId),
  ],
);

// ════════════════════════════════════════════════════════════════════════════
// Student roster — the source of truth for poll audience eligibility.
// Rows enter ONLY through the coordinator roster UI (never seed files in git).
// ════════════════════════════════════════════════════════════════════════════

export const student = pgTable(
  "student",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    usn: text("usn").notNull().unique(), // stored uppercase
    email: text("email").notNull().unique(), // stored lowercase
    batch: text("batch").notNull(), // e.g. '2025-27'
    section: text("section").notNull(), // e.g. 'A'
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("student_batch_section_idx").on(t.batch, t.section)],
);

// ════════════════════════════════════════════════════════════════════════════
// Polls — one table for both kinds:
//   'quick'    → Quick Polls (single / multiple choice, yes-no, short answer)
//   'seatlock' → SeatLock (limited seats per option, first come first served)
// ════════════════════════════════════════════════════════════════════════════

export const poll = pgTable(
  "poll",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    creatorId: text("creator_id").references(() => user.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(), // 'quick' | 'seatlock'
    // quick: 'single' | 'multiple' | 'yes_no' | 'short_answer'; seatlock: 'single'
    questionType: text("question_type").notNull().default("single"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"), // 'draft' | 'open' | 'closed'
    audienceMode: text("audience_mode").notNull().default("all"), // 'all' | 'group' | 'custom'
    // 'shared' → any poll manager can manage it; 'private' → creator + accepted collaborators
    manageMode: text("manage_mode").notNull().default("shared"),
    showResults: boolean("show_results").notNull().default(false),
    isAnonymous: boolean("is_anonymous").notNull().default(false), // quick polls only
    allowVoteChange: boolean("allow_vote_change").notNull().default(true), // quick polls only
    closesAt: timestamp("closes_at", { mode: "date" }), // enforced: past this the poll is closed
    openedAt: timestamp("opened_at", { mode: "date" }),
    closedAt: timestamp("closed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("poll_status_idx").on(t.status),
    index("poll_creator_id_idx").on(t.creatorId),
  ],
);

export const pollOption = pgTable(
  "poll_option",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    capacity: integer("capacity"), // seatlock only
    seatsTaken: integer("seats_taken").notNull().default(0), // only mutated by the atomic seat-lock statement
    position: integer("position").notNull(),
    status: text("status").notNull().default("active"), // 'active' | 'archived'
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("poll_option_poll_position_unique").on(t.pollId, t.position)],
);

// 'group' audience: exactly one batch (+ optional section) per poll.
export const pollAudienceRule = pgTable(
  "poll_audience_rule",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    batch: text("batch").notNull(),
    section: text("section"), // null = every section in the batch
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("poll_audience_rule_poll_id_unique").on(t.pollId)],
);

// 'custom' audience: explicit allow-list of roster students.
export const pollAudienceMember = pgTable(
  "poll_audience_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("poll_audience_member_poll_student_unique").on(t.pollId, t.studentId),
  ],
);

// 'group' audience: students excluded from an otherwise matching group.
export const pollAudienceExclusion = pgTable(
  "poll_audience_exclusion",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("poll_audience_exclusion_poll_student_unique").on(
      t.pollId,
      t.studentId,
    ),
  ],
);

// One row per user per poll. Chosen options live in poll_response_option.
export const pollResponse = pgTable(
  "poll_response",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    textAnswer: text("text_answer"), // short_answer polls only
    // Roster snapshot at submission time (audit trail if the roster changes).
    studentUsn: text("student_usn"),
    studentName: text("student_name"),
    studentBatch: text("student_batch"),
    studentSection: text("student_section"),
    // Set only when submitted through a reopen grant on a closed poll.
    reopenGrantId: text("reopen_grant_id").references(
      (): AnyPgColumn => pollReopenGrant.id,
      { onDelete: "set null" },
    ),
    submittedAt: timestamp("submitted_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("poll_response_poll_user_unique").on(t.pollId, t.userId),
    index("poll_response_poll_id_idx").on(t.pollId),
  ],
);

export const pollResponseOption = pgTable(
  "poll_response_option",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    responseId: text("response_id")
      .notNull()
      .references(() => pollResponse.id, { onDelete: "cascade" }),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOption.id, { onDelete: "restrict" }),
  },
  (t) => [
    unique("poll_response_option_response_option_unique").on(
      t.responseId,
      t.optionId,
    ),
    index("poll_response_option_option_id_idx").on(t.optionId),
    index("poll_response_option_poll_id_idx").on(t.pollId),
  ],
);

// Lets a manager admit specific roster students into a closed (or otherwise
// out-of-audience) poll. Revoking sets revokedAt instead of deleting, so the
// full history of late access stays auditable.
export const pollReopenGrant = pgTable(
  "poll_reopen_grant",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    remarks: text("remarks").notNull(),
    grantedBy: text("granted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    grantedAt: timestamp("granted_at", { mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    revokedBy: text("revoked_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("poll_reopen_grant_poll_student_active_unique")
      .on(t.pollId, t.studentId)
      .where(sql`${t.revokedAt} is null`),
    index("poll_reopen_grant_poll_id_idx").on(t.pollId),
  ],
);

// Collaborators on a 'private' poll. Only users who can manage polls may be
// invited; access starts once the invitee accepts.
export const pollCollaborator = pgTable(
  "poll_collaborator",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pollId: text("poll_id")
      .notNull()
      .references(() => poll.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined'
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at", { mode: "date" }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { mode: "date" }),
  },
  (t) => [
    unique("poll_collaborator_poll_user_unique").on(t.pollId, t.userId),
    index("poll_collaborator_user_id_idx").on(t.userId),
  ],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, { fields: [auditLog.actorId], references: [user.id] }),
}));

export const studentRelations = relations(student, ({ many }) => ({
  audienceMemberships: many(pollAudienceMember),
  audienceExclusions: many(pollAudienceExclusion),
  reopenGrants: many(pollReopenGrant),
}));

export const pollRelations = relations(poll, ({ one, many }) => ({
  creator: one(user, { fields: [poll.creatorId], references: [user.id] }),
  options: many(pollOption),
  audienceRules: many(pollAudienceRule),
  audienceMembers: many(pollAudienceMember),
  audienceExclusions: many(pollAudienceExclusion),
  responses: many(pollResponse),
  reopenGrants: many(pollReopenGrant),
  collaborators: many(pollCollaborator),
}));

export const pollOptionRelations = relations(pollOption, ({ one, many }) => ({
  poll: one(poll, { fields: [pollOption.pollId], references: [poll.id] }),
  responseOptions: many(pollResponseOption),
}));

export const pollAudienceRuleRelations = relations(
  pollAudienceRule,
  ({ one }) => ({
    poll: one(poll, { fields: [pollAudienceRule.pollId], references: [poll.id] }),
  }),
);

export const pollAudienceMemberRelations = relations(
  pollAudienceMember,
  ({ one }) => ({
    poll: one(poll, {
      fields: [pollAudienceMember.pollId],
      references: [poll.id],
    }),
    student: one(student, {
      fields: [pollAudienceMember.studentId],
      references: [student.id],
    }),
  }),
);

export const pollAudienceExclusionRelations = relations(
  pollAudienceExclusion,
  ({ one }) => ({
    poll: one(poll, {
      fields: [pollAudienceExclusion.pollId],
      references: [poll.id],
    }),
    student: one(student, {
      fields: [pollAudienceExclusion.studentId],
      references: [student.id],
    }),
  }),
);

export const pollResponseRelations = relations(
  pollResponse,
  ({ one, many }) => ({
    poll: one(poll, { fields: [pollResponse.pollId], references: [poll.id] }),
    user: one(user, { fields: [pollResponse.userId], references: [user.id] }),
    reopenGrant: one(pollReopenGrant, {
      fields: [pollResponse.reopenGrantId],
      references: [pollReopenGrant.id],
    }),
    options: many(pollResponseOption),
  }),
);

export const pollResponseOptionRelations = relations(
  pollResponseOption,
  ({ one }) => ({
    response: one(pollResponse, {
      fields: [pollResponseOption.responseId],
      references: [pollResponse.id],
    }),
    option: one(pollOption, {
      fields: [pollResponseOption.optionId],
      references: [pollOption.id],
    }),
  }),
);

export const pollReopenGrantRelations = relations(
  pollReopenGrant,
  ({ one }) => ({
    poll: one(poll, { fields: [pollReopenGrant.pollId], references: [poll.id] }),
    student: one(student, {
      fields: [pollReopenGrant.studentId],
      references: [student.id],
    }),
    grantor: one(user, {
      fields: [pollReopenGrant.grantedBy],
      references: [user.id],
    }),
  }),
);

export const pollCollaboratorRelations = relations(
  pollCollaborator,
  ({ one }) => ({
    poll: one(poll, { fields: [pollCollaborator.pollId], references: [poll.id] }),
    user: one(user, {
      fields: [pollCollaborator.userId],
      references: [user.id],
    }),
  }),
);
