/**
 * Sign-up / sign-in email policy.
 *
 * Restricts accounts to a college email domain, configurable so the
 * platform can open up to other colleges later.
 *
 *   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=bmsce.ac.in   → only @bmsce.ac.in
 *   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=              → any valid email
 *
 * It is a NEXT_PUBLIC_ variable because the same check runs in the browser
 * (form validation) and on the server (Better Auth hooks).
 */
const ALLOWED_DOMAIN = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "")
  .trim()
  .toLowerCase()
  .replace(/^@/, "");

export const EMAIL_DOMAIN_RESTRICTED = ALLOWED_DOMAIN.length > 0;

export const EMAIL_PLACEHOLDER = EMAIL_DOMAIN_RESTRICTED
  ? `yourname@${ALLOWED_DOMAIN}`
  : "you@example.com";

export const EMAIL_POLICY_ERROR = EMAIL_DOMAIN_RESTRICTED
  ? `Only @${ALLOWED_DOMAIN} email addresses are allowed on Peerly.`
  : "Please enter a valid email address.";

export const EMAIL_POLICY_ERROR_CODE = "email_domain_not_allowed";

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  if (!EMAIL_DOMAIN_RESTRICTED) return normalized.includes("@");
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}
