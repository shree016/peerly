import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

function getFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }
  return from;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });

  if (error) {
    console.error("Resend email failed:", error);
    throw new Error(error.message ?? "Failed to send email.");
  }

  return data;
}

/** Whoever signs up chooses the name, so it must not become HTML in someone's inbox. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildVerificationEmailHtml({
  name,
  url: rawUrl,
}: {
  name?: string | null;
  url: string;
}) {
  const greeting = greetingFor(name);
  const url = escapeHtml(rawUrl);

  return `<!DOCTYPE html>
<html lang="en">
  <body style="${BODY_STYLE}">
    <p>${greeting}</p>
    <p>Thanks for signing up. Please verify your email address to continue using Peeerly</p>
    ${linkButton(url, "Verify email address")}
    <p style="${MUTED_STYLE}">
      If you didn't sign up for Peeerly, don't open the link.
    </p>
  </body>
</html>`;
}

const BODY_STYLE =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #111827; max-width: 560px; margin: 0 auto; padding: 24px;";
const MUTED_STYLE = "font-size: 14px; color: #6b7280;";

/** A button plus the raw link for mail apps that strip buttons. `url` must already be escaped. */
function linkButton(url: string, label: string) {
  return `<p style="margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background: #2f6bff; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 600;">
        ${label}
      </a>
    </p>
    <p style="${MUTED_STYLE}">
      If the button does not work, copy and paste this link into your browser:<br>
      <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a>
    </p>`;
}

function greetingFor(name?: string | null) {
  return name?.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
}

export function buildPasswordResetEmailHtml({
  name,
  url: rawUrl,
}: {
  name?: string | null;
  url: string;
}) {
  const url = escapeHtml(rawUrl);
  return `<!DOCTYPE html>
<html lang="en">
  <body style="${BODY_STYLE}">
    <p>${greetingFor(name)}</p>
    <p>Someone asked to set a new password for your Peeerly account. If that was you, choose your new password here. The link works for 1 hour.</p>
    ${linkButton(url, "Choose a new password")}
    <p style="${MUTED_STYLE}">
      If you didn't ask for this, ignore this email. Your password stays the same.
    </p>
  </body>
</html>`;
}

/**
 * Sent after a password is added or changed, so the owner hears about it
 * even if someone else did it on a phone they left logged in.
 */
export function buildPasswordNoticeEmailHtml({
  name,
  change,
  resetUrl: rawResetUrl,
}: {
  name?: string | null;
  change: "added" | "changed";
  resetUrl: string;
}) {
  const resetUrl = escapeHtml(rawResetUrl);
  const what =
    change === "added"
      ? "A password was added to your Peeerly account. You can now log in with your email and this password, as well as with Google."
      : "The password for your Peeerly account was just changed, and your other devices were logged out.";
  return `<!DOCTYPE html>
<html lang="en">
  <body style="${BODY_STYLE}">
    <p>${greetingFor(name)}</p>
    <p>${what}</p>
    <p>If this was you, there's nothing else to do.</p>
    <p style="${MUTED_STYLE}">
      If it wasn't you, set a new password right away at
      <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
      and tell a coordinator.
    </p>
  </body>
</html>`;
}
