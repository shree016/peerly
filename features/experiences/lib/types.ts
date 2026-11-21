import {
  InterviewExperience,
  InterviewExperienceComment,
  InterviewExperienceResource,
  InterviewExperienceRound,
  User,
} from "@/types";

import { RoundOutcome, RoundType, difficultyOptions } from "./validation";

export type ExperienceWithAuthor = InterviewExperience & {
  author: Pick<User, "id" | "name" | "image">;
  rounds: InterviewExperienceRound[];
  resources: InterviewExperienceResource[];
};

export type CommentWithAuthor = InterviewExperienceComment & {
  author: Pick<User, "id" | "name" | "image">;
};

export type ExperienceListItem = InterviewExperience & {
  author: Pick<User, "id" | "name" | "image">;
  roundCount: number;
  clearedRoundCount: number;
  /** Round outcomes in round order — null where the author didn't record one. */
  roundOutcomes: (RoundOutcome | null)[];
  resourceCount: number;
  commentCount: number;
};

/** Drive-level details reusable by anyone else writing up the same drive. */
export type ExperienceTemplate = {
  key: string;
  companyName: string;
  companyLogoUrl: string | null;
  role: string;
  batch: string;
  ctcLpa: number | null;
  jd: { url: string; fileName: string } | null;
  rounds: {
    roundType: RoundType;
    difficulty: (typeof difficultyOptions)[number] | undefined;
  }[];
  postCount: number;
  lastSharedAt: Date;
};
