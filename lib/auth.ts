import { BASE_ERROR_CODES, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import {
  buildPasswordResetEmailHtml,
  buildVerificationEmailHtml,
  sendEmail,
} from "@/lib/email";
import { allowEmailSend } from "@/lib/email-send-limit";

import db from "@/db";
import { session as sessionTable, user as userTable } from "@/db/schema";
import { EMAIL_POLICY_ERROR_CODE, isAllowedEmail } from "@/lib/email-policy";
import { isSuperAdminEmail } from "@/lib/permissions/owners";
import { DEFAULT_ROLE, ac, roles } from "@/lib/permissions/roles";
import { syncExternalProfileImageToS3 } from "@/lib/s3/profile-image";

function rejectDisallowedEmail(email: string | null | undefined) {
  if (!email || !isAllowedEmail(email)) {
    throw new APIError("BAD_REQUEST", { message: EMAIL_POLICY_ERROR_CODE });
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    // No session until the inbox is proven. This also makes sign-up answer the
    // same way for new and taken emails.
    requireEmailVerification: true,
    // Forgot password. The link works for an hour and only once.
    resetPasswordTokenExpiresIn: 60 * 60,
    // Whoever knew the old password is logged out everywhere.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Skipped quietly, so the page answers the same way for every address.
      // A link from the last hour still works.
      if (!(await allowEmailSend("reset-password", user.email))) {
        console.warn("Password reset email skipped: hourly limit for this address.");
        return;
      }
      await sendEmail({
        to: user.email,
        subject: "Reset your Peeerly password",
        text: `Hi${user.name ? ` ${user.name}` : ""},

Someone asked to set a new password for your Peeerly account. If that was you, choose your new password here (the link works for 1 hour):
${url}

If you didn't ask for this, ignore this email. Your password stays the same.`,
        html: buildPasswordResetEmailHtml({ name: user.name, url }),
      });
    },
    onPasswordReset: async ({ user }) => {
      // The reset link was opened from this inbox, which proves the address
      // just as a verification link does. Without this, a person whose email
      // someone else signed up with first would reset the password and still
      // be locked out as "unverified".
      if (!user.emailVerified) {
        await db
          .update(userTable)
          .set({ emailVerified: true })
          .where(eq(userTable.id, user.id));
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Only reached with the correct password, so it doubles as "resend".
    sendOnSignIn: true,
    // Sessions from before the inbox was proven may belong to someone else,
    // and must not come alive when the real owner clicks the link.
    beforeEmailVerification: async (user) => {
      await db.delete(sessionTable).where(eq(sessionTable.userId, user.id));
    },
    sendVerificationEmail: async ({ user, url }) => {
      // Skipped quietly, so sign-up still answers the same way for every
      // address. A link from the last hour is still valid.
      if (!(await allowEmailSend("verify-email", user.email))) {
        console.warn("Verification email skipped: hourly limit for this address.");
        return;
      }
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Hi${user.name ? ` ${user.name}` : ""},\n\nClick the link below to verify your email address:\n${url}\n\nIf you didn't sign up for Peeerly, don't open the link.`,
        html: buildVerificationEmailHtml({ name: user.name, url }),
      });
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // The admin plugin's own HTTP endpoints (set-role, ban, impersonate,
      // set-password, remove-user, …) would bypass our audit log and the
      // "last admin can't be removed" rule, so they are closed off entirely.
      // Role, ban and session changes go through features/admin/lib/actions.ts.
      if (ctx.path.startsWith("/admin/")) {
        throw new APIError("FORBIDDEN", { message: "Not available." });
      }
      if (
        ctx.path === "/sign-up/email" ||
        ctx.path === "/sign-in/email" ||
        ctx.path === "/request-password-reset"
      ) {
        rejectDisallowedEmail(ctx.body?.email as string | undefined);
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          rejectDisallowedEmail(user.email);
          // Whoever signs up picks the password, so owner accounts can only be
          // created with Google. Better Auth turns a 403 from this hook into
          // its normal sign-up response, so owner addresses aren't revealed.
          if (ctx?.path === "/sign-up/email" && isSuperAdminEmail(user.email)) {
            throw new APIError("FORBIDDEN");
          }
          return { data: user };
        },
        after: async (user) => {
          try {
            const s3Url = await syncExternalProfileImageToS3(user.id, user.image);
            if (s3Url) {
              await db
                .update(userTable)
                .set({ image: s3Url })
                .where(eq(userTable.id, user.id));
            }
          } catch (error) {
            console.error("Failed to store OAuth profile image in S3:", error);
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const account = await db.query.user.findFirst({
            where: eq(userTable.id, session.userId),
            columns: { email: true, emailVerified: true },
          });
          rejectDisallowedEmail(account?.email);
          // Covers every other way of getting a session, such as OAuth.
          if (!account?.emailVerified) {
            throw APIError.from(
              "FORBIDDEN",
              BASE_ERROR_CODES.EMAIL_NOT_VERIFIED,
            );
          }
          return { data: session };
        },
        after: async (session) => {
          try {
            const account = await db.query.user.findFirst({
              where: eq(userTable.id, session.userId),
              columns: { id: true, image: true },
            });

            if (!account?.image) return;

            const s3Url = await syncExternalProfileImageToS3(
              account.id,
              account.image,
            );

            if (s3Url) {
              await db
                .update(userTable)
                .set({ image: s3Url })
                .where(eq(userTable.id, account.id));
            }
          } catch (error) {
            console.error("Failed to sync profile image to S3 on login:", error);
          }
        },
      },
    },
  },
  plugins: [
    // Adds role/banned columns, assigns the default role on sign-up and
    // refuses new sessions for banned users.
    admin({
      ac,
      roles,
      defaultRole: DEFAULT_ROLE,
      adminRoles: ["admin"],
      bannedUserMessage:
        "Your Peeerly account has been suspended. Contact a coordinator if you think this is a mistake.",
    }),
    nextCookies(),
  ],
  onAPIError: {
    errorURL: "/auth/login",
  },
});
