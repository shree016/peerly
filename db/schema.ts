/**
 * Peeerly database schema.
 *
 * Tables: auth (user/session/account/verification), Placement Experiences
 * (interview_experience*), and Quiz (quiz_*).
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
  isCoordinator: boolean("is_coordinator").notNull().default(false),
  isElectivePollAdmin: boolean("is_elective_poll_admin")
    .notNull()
    .default(false),
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


// ─── Relations ───────────────────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  quizEvents: many(quizEvent),
  quizSessions: many(quizSession),
  interviewExperiences: many(interviewExperience),
  interviewExperienceComments: many(interviewExperienceComment),
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

