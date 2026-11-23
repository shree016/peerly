"use server";

import { headers } from "next/headers";

import { isAPIError } from "better-auth/api";
import { and, eq, isNotNull } from "drizzle-orm";

import { AppError, runAction } from "@/lib/app-error";
import { auth } from "@/lib/auth";
import { buildPasswordNoticeEmailHtml, sendEmail } from "@/lib/email";
import { allowEmailSend } from "@/lib/email-send-limit";
import { rateLimit } from "@/lib/rate-limit";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  newPasswordSchema,
} from "@/validation/auth";

import db from "@/db";
import { account } from "@/db/schema";
import { validateOrThrow } from "@/validation";

import { getUser } from "./user";

/** Where the reset email's link lands (app/auth/reset-password). */
const RESET_PAGE = "/auth/reset-password";
/** Adding a password needs a login from the last day: see setPassword. */
const SET_PASSWORD_MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

const SENT_MESSAGE =
  "If an account uses that email, we've sent it a link to choose a new password. Check your inbox and spam folder. The link works for 1 hour.";

async function clientIp() {
  const forwarded = (await headers()).get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function siteUrl(path: string) {
  const base = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

/** Tells the owner a password was added or changed. Never blocks the change. */
async function sendPasswordNotice(
  user: { email: string; name: string | null },
  change: "added" | "changed",
) {
  try {
    if (!(await allowEmailSend("password-notice", user.email))) return;
    const resetUrl = siteUrl("/auth/forgot-password");
    await sendEmail({
      to: user.email,
      subject:
        change === "added"
          ? "A password was added to your Peeerly account"
          : "Your Peeerly password was changed",
      text: `Hi${user.name ? ` ${user.name}` : ""},\n\n${
        change === "added"
          ? "A password was added to your Peeerly account."
          : "The password for your Peeerly account was just changed, and your other devices were logged out."
      }\n\nIf this was you, there's nothing else to do. If it wasn't, set a new password right away at ${resetUrl} and tell a coordinator.`,
      html: buildPasswordNoticeEmailHtml({ name: user.name, change, resetUrl }),
    });
  } catch (error) {
    console.error("Password notice email failed:", error);
  }
}

/**
 * Forgot password: emails a reset link. Answers the same way whether or not
 * the address has an account, so it can't be used to find out who's signed up.
 */
export async function requestPasswordReset({ email }: { email: string }) {
  return runAction(async () => {
    const data = validateOrThrow(forgotPasswordSchema, { email });

    // Speed bump per network (campus NAT shares IPs, so it's generous). Each
    // inbox also gets at most 3 reset emails an hour (lib/auth.ts).
    if (!rateLimit(`password-reset:${await clientIp()}`, 20, 15 * 60_000)) {
      throw new AppError(
        "TOO_MANY_REQUESTS",
        "Too many requests. Please wait a few minutes and try again.",
        429,
      );
    }

    await auth.api.requestPasswordReset({
      body: { email: data.email.trim().toLowerCase(), redirectTo: RESET_PAGE },
      headers: await headers(),
    });
    return { message: SENT_MESSAGE };
  });
}

/** Sets the new password from a reset link. Logs out every other device. */
export async function resetPassword(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return runAction(async () => {
    const data = validateOrThrow(newPasswordSchema, input);
    if (!input.token) {
      throw new AppError("INVALID_TOKEN", "This reset link isn't valid.", 400);
    }

    try {
      await auth.api.resetPassword({
        body: { token: input.token, newPassword: data.newPassword },
        headers: await headers(),
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_TOKEN") {
        throw new AppError(
          "INVALID_TOKEN",
          "This reset link has expired or was already used. Ask for a new one.",
          400,
        );
      }
      throw error;
    }
    return { done: true };
  });
}

/**
 * Whether the logged-in user can log in with a password (vs Google only).
 * Takes no id on purpose: every export here is callable from the browser.
 */
export async function getHasPassword() {
  const user = await getUser();
  if (!user) return false;
  const row = await db.query.account.findFirst({
    where: and(
      eq(account.userId, user.id),
      eq(account.providerId, "credential"),
      isNotNull(account.password),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

/**
 * Google accounts adding a password, from the profile page. Better Auth only
 * needs a valid session for this, which lasts days — so on a phone someone
 * left logged in, anyone could add their own password and keep access later.
 * Asking for a login from the last day closes that, and the owner is emailed.
 */
export async function setPassword(input: {
  newPassword: string;
  confirmPassword: string;
}) {
  return runAction(async () => {
    const user = await getUser();
    if (!user || user.banned) {
      throw new AppError("UNAUTHORIZED", "Log in again to continue.", 401);
    }
    const data = validateOrThrow(newPasswordSchema, input);

    const requestHeaders = await headers();
    const current = await auth.api.getSession({ headers: requestHeaders });
    const loggedInAt = current?.session.createdAt
      ? new Date(current.session.createdAt).getTime()
      : 0;
    if (Date.now() - loggedInAt > SET_PASSWORD_MAX_SESSION_AGE_MS) {
      throw new AppError(
        "LOGIN_AGAIN",
        "For your safety, log out and log in with Google again, then set your password.",
        403,
      );
    }

    try {
      await auth.api.setPassword({
        body: { newPassword: data.newPassword },
        headers: requestHeaders,
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "PASSWORD_ALREADY_SET") {
        throw new AppError(
          "PASSWORD_ALREADY_SET",
          "Your account already has a password. Use Change password instead.",
          400,
        );
      }
      throw error;
    }

    await sendPasswordNotice(user, "added");
    return { done: true };
  });
}

/** Changing an existing password. Needs the current one; logs out other devices. */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return runAction(async () => {
    const user = await getUser();
    if (!user || user.banned) {
      throw new AppError("UNAUTHORIZED", "Log in again to continue.", 401);
    }
    const data = validateOrThrow(changePasswordSchema, input);

    // Stops guessing the current password from a logged-in session.
    if (!rateLimit(`password-change:${user.id}`, 5, 15 * 60_000)) {
      throw new AppError(
        "TOO_MANY_REQUESTS",
        "Too many attempts. Please wait 15 minutes and try again.",
        429,
      );
    }

    try {
      await auth.api.changePassword({
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (error) {
      if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
        throw new AppError(
          "INVALID_PASSWORD",
          "Your current password is wrong.",
          400,
          "currentPassword",
        );
      }
      if (
        isAPIError(error) &&
        error.body?.code === "CREDENTIAL_ACCOUNT_NOT_FOUND"
      ) {
        throw new AppError(
          "NO_PASSWORD",
          "Your account doesn't have a password yet. Use Set password instead.",
          400,
        );
      }
      throw error;
    }

    await sendPasswordNotice(user, "changed");
    return { done: true };
  });
}
