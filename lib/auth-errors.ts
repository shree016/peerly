import { EMAIL_POLICY_ERROR, EMAIL_POLICY_ERROR_CODE } from "@/lib/email-policy";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [EMAIL_POLICY_ERROR_CODE]: EMAIL_POLICY_ERROR,
  please_restart_the_process:
    "Your sign-in session expired or was interrupted. Please try again.",
  state_mismatch: "Sign-in could not be verified. Please try again.",
  oauth_provider_not_found: "This sign-in provider is not available.",
  invalid_code: "Sign-in failed. Please try again.",
  unable_to_create_user: "We could not create your account. Please try again.",
  signup_disabled: "New sign-ups are not allowed for this provider.",
  email_not_found:
    "We could not read an email from your account. Try another sign-in method.",
};

export function resolveAuthErrorMessage(
  error: string | null | undefined,
  description?: string | null,
): string | null {
  if (description?.trim()) return description.trim();
  if (!error) return null;

  const decoded = error.replace(/_/g, " ");
  const lower = decoded.toLowerCase();

  if (
    error === EMAIL_POLICY_ERROR_CODE ||
    lower.includes("email addresses are allowed")
  ) {
    return EMAIL_POLICY_ERROR;
  }

  return (
    AUTH_ERROR_MESSAGES[error] ??
    AUTH_ERROR_MESSAGES[error.toLowerCase()] ??
    "Sign-in failed. Please try again."
  );
}
