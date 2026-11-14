/**
 * Who can create and manage quizzes on Peerly.
 *
 * The default list is the MCA Section B activity coordinators. Add more
 * without a code change via a comma-separated env var:
 *
 *   QUIZ_ADMIN_EMAILS=someone@college.edu,another@college.edu
 */
const DEFAULT_QUIZ_ADMIN_EMAILS = [
  "prashantkumar.mca25@bmsce.ac.in",
  "rukkaiya.mca25@bmsce.ac.in",
  "saikumar.mca25@bmsce.ac.in",
  "sandeepanr.mca25@bmsce.ac.in",
  "tanishg.mca25@bmsce.ac.in",
  "tarunp.mca25@bmsce.ac.in",
  "tejdeepbn.mca25@bmsce.ac.in",
  "shrilaxmi.mca25@bmsce.ac.in",
] as const;

const envAdminEmails = (process.env.QUIZ_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

const quizAdminEmailSet = new Set<string>(
  [...DEFAULT_QUIZ_ADMIN_EMAILS, ...envAdminEmails].map((email) =>
    email.toLowerCase(),
  ),
);

export function isQuizAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return quizAdminEmailSet.has(email.toLowerCase().trim());
}
