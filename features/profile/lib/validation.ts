import z from "zod";

import { type SocialNetwork, socialUsername } from "./social-links";

const socialLink = (network: SocialNetwork, label: string) =>
  z
    .string()
    .refine((value) => !value.trim() || socialUsername(network, value), {
      message: `Enter your ${label} username or profile link`,
    })
    .optional();

export const editProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters long")
    .max(50, "Name must be at most 50 characters long"),
  bio: z.string().max(500, "Bio must be at most 500 characters long"),
  image: z.url().optional().or(z.literal("")),
  github: socialLink("github", "GitHub"),
  twitter: socialLink("twitter", "Twitter"),
  linkedin: socialLink("linkedin", "LinkedIn"),
  portfolio: z
    .string()
    .url("Invalid Portfolio URL")
    .optional()
    .or(z.literal("")),
});
