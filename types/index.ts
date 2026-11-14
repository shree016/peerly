// Drizzle Schema Types
import * as schema from "@/db/schema";

// User Types
export type User = typeof schema.user.$inferSelect;
export type NewUser = typeof schema.user.$inferInsert;

// Placement Experience Types
export type InterviewExperience = typeof schema.interviewExperience.$inferSelect;
export type NewInterviewExperience =
  typeof schema.interviewExperience.$inferInsert;
export type InterviewExperienceRound =
  typeof schema.interviewExperienceRound.$inferSelect;
export type NewInterviewExperienceRound =
  typeof schema.interviewExperienceRound.$inferInsert;
export type InterviewExperienceResource =
  typeof schema.interviewExperienceResource.$inferSelect;
export type NewInterviewExperienceResource =
  typeof schema.interviewExperienceResource.$inferInsert;
export type InterviewExperienceComment =
  typeof schema.interviewExperienceComment.$inferSelect;
export type NewInterviewExperienceComment =
  typeof schema.interviewExperienceComment.$inferInsert;

// Auth Types
export type Session = typeof schema.session.$inferSelect;
export type NewSession = typeof schema.session.$inferInsert;
export type Account = typeof schema.account.$inferSelect;
export type NewAccount = typeof schema.account.$inferInsert;
export type Verification = typeof schema.verification.$inferSelect;
export type NewVerification = typeof schema.verification.$inferInsert;
