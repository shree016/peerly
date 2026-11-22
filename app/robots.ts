import type { MetadataRoute } from "next";

/**
 * Served at /robots.txt. Public pages (landing, login, sign-up, quiz join)
 * stay crawlable; signed-in areas are excluded — they only ever answer
 * crawlers with a login redirect, and API routes are never useful to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/profile",
        "/polls",
        "/experiences",
        "/quiz/events",
        "/quiz/sessions",
        "/quiz/play",
      ],
    },
  };
}
