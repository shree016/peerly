import z from "zod";

import { EMAIL_POLICY_ERROR, isAllowedEmail } from "@/lib/email-policy";

export const password = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
    },
  );

const allowedEmail = z
  .email("Please enter a valid email address")
  .refine((value) => isAllowedEmail(value), { message: EMAIL_POLICY_ERROR });

export const signInSchema = z.object({
  email: allowedEmail,
  password: password,
});

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters long.")
    .max(50, "Name must not exceed 50 characters"),
  email: allowedEmail,
  password: password,
});

export const forgotPasswordSchema = z.object({ email: allowedEmail });

/** Choosing a password: reset link, or a Google account adding one. */
export const newPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export const signUpWithConfirmSchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters long.")
      .max(50, "Name must not exceed 50 characters"),
    email: allowedEmail,
    password: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
