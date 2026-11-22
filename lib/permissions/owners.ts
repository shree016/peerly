// Server-only: reads a private env var. Kept free of other app imports so
// lib/auth.ts can use it without an import cycle.

/**
 * Owner accounts, set only through the private SUPER_ADMIN_EMAILS env var
 * (Vercel / .env.local — never committed).
 */
const superAdminEmails = new Set(
  (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** Whether the address is on the owner list. Says nothing about who holds it. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return superAdminEmails.has(email.trim().toLowerCase());
}

/**
 * Whether the account really is an owner. Anyone can type an email address,
 * so owner power also needs proof of the inbox (Google or a verification link).
 */
export function isVerifiedOwner(account: {
  email: string;
  emailVerified: boolean;
}): boolean {
  return account.emailVerified && isSuperAdminEmail(account.email);
}
