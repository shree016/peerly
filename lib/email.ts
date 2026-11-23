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
  const greeting = name?.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
  const url = escapeHtml(rawUrl);

  return `<!DOCTYPE html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #111827; max-width: 560px; margin: 0 auto; padding: 24px;">
    <p>${greeting}</p>
    <p>Thanks for signing up. Please verify your email address to continue using Peeerly</p>
    <p style="margin: 32px 0;">
      <a href="${url}" style="display: inline-block; background: #2f6bff; color: #ffffff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 600;">
        Verify email address
      </a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      If the button does not work, copy and paste this link into your browser:<br>
      <a href="${url}" style="color: #2563eb; word-break: break-all;">${url}</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      If you didn't sign up for Peeerly, don't open the link.
    </p>
  </body>
</html>`;
}
