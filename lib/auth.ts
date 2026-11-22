import { BASE_ERROR_CODES, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { eq } from "drizzle-orm";

import { buildVerificationEmailHtml, sendEmail } from "@/lib/email";

import db from "@/db";
import { user as userTable } from "@/db/schema";
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
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Hi${user.name ? ` ${user.name}` : ""},\n\nClick the link below to verify your email address:\n${url}`,
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
      if (ctx.path === "/sign-up/email" || ctx.path === "/sign-in/email") {
        rejectDisallowedEmail(ctx.body?.email as string | undefined);
      }
      // A password sign-up proves nothing about who owns the inbox, so owner
      // accounts can only be created with Google. The error is the same as
      // for a taken email, so it doesn't reveal which addresses are owners.
      if (
        ctx.path === "/sign-up/email" &&
        isSuperAdminEmail(ctx.body?.email as string | undefined)
      ) {
        throw APIError.from(
          "UNPROCESSABLE_ENTITY",
          BASE_ERROR_CODES.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL,
        );
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          rejectDisallowedEmail(user.email);
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
            columns: { email: true },
          });
          rejectDisallowedEmail(account?.email);
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
