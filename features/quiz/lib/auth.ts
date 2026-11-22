import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

import type { User } from "@/types";

export class QuizApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public field?: string,
  ) {
    super(message);
    this.name = "QuizApiError";
  }
}

/** Quiz management is gated by the `quiz:manage` permission (activity
 * coordinators and admins — see lib/permissions/roles.ts). */
export async function requireAdmin(): Promise<User> {
  const user = await getUser();
  if (!user || user.banned) {
    throw new QuizApiError("UNAUTHORIZED", "Authentication required.", 401);
  }
  if (!userCan(user, "quiz:manage")) {
    throw new QuizApiError(
      "FORBIDDEN",
      "Only activity coordinators can manage quizzes.",
      403,
    );
  }
  return user;
}

export function canManageQuiz(
  user: Pick<User, "role" | "email" | "emailVerified"> | null | undefined,
): boolean {
  return userCan(user, "quiz:manage");
}

export function isQuizApiError(error: unknown): error is QuizApiError {
  return error instanceof QuizApiError;
}

export function quizErrorBody(error: QuizApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
    },
  };
}
