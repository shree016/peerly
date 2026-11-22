"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isAPIError } from "better-auth/api";

import { AppError, runAction } from "@/lib/app-error";
import { auth } from "@/lib/auth";
import { EMAIL_POLICY_ERROR, isAllowedEmail } from "@/lib/email-policy";

import { signInSchema, signUpSchema } from "@/validation/auth";

import { validateOrThrow } from "@/validation";

import { getUser } from "./user";

const VERIFIED_CALLBACK_URL = "/auth/login?verified=1";

export async function signInSocial(
  provider: "google" | "github",
  callbackUrl?: string,
) {
  const { url, redirect: shouldRedirect } = await auth.api.signInSocial({
    body: {
      provider,
      callbackURL: callbackUrl || "/dashboard",
      errorCallbackURL: "/auth/login",
    },
  });

  if (shouldRedirect && url) {
    redirect(url);
  }
}

export async function signIn({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  // Returned rather than thrown: production masks thrown messages, and the
  // person needs to read "verify your email".
  return runAction(async () => {
    validateOrThrow(signInSchema, { email, password });

    if (!isAllowedEmail(email)) {
      throw new AppError("EMAIL_POLICY", EMAIL_POLICY_ERROR, 400);
    }

    try {
      const { user } = await auth.api.signInEmail({
        body: { email, password, callbackURL: VERIFIED_CALLBACK_URL },
        headers: await headers(),
      });
      return user;
    } catch (error) {
      if (!isAPIError(error) || !error.body?.message) throw error;

      const code = error.body.code ?? "SIGN_IN_FAILED";
      const message =
        code === "EMAIL_NOT_VERIFIED"
          ? "Verify your email before logging in. We've sent a new link, so check your inbox and spam folder."
          : error.body.message;
      throw new AppError(code, message, error.statusCode);
    }
  });
}

export async function signUp({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  validateOrThrow(signUpSchema, { name, email, password });

  if (!isAllowedEmail(email)) {
    throw new Error(EMAIL_POLICY_ERROR);
  }

  // Sends the verification link and does not sign the person in. Don't send
  // another one here: for a taken email it would deliver a link that activates
  // the password chosen by whoever registered that address first.
  const { user } = await auth.api.signUpEmail({
    body: { name, email, password, callbackURL: VERIFIED_CALLBACK_URL },
    headers: await headers(),
  });

  if (!user) {
    throw new Error("Failed to sign up");
  }
}

export async function logout() {
  await auth.api.signOut({
    headers: await headers(),
  });

  revalidatePath("/dashboard");
}

export async function resendVerificationEmail() {
  const user = await getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  await auth.api.sendVerificationEmail({
    body: { email: user.email, callbackURL: "/dashboard" },
    headers: await headers(),
  });

  return { success: true };
}
