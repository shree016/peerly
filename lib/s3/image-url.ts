/**
 * Client-safe image URL helpers — pure string functions, NO AWS SDK import.
 *
 * Client components must import from here, never from `./profile-image` or
 * `./storage`: those import `@aws-sdk/client-s3` at the top, and any client
 * import of them ships the whole S3 SDK to every visitor's browser.
 * (`./profile-image` and `./storage` re-export these for server code.)
 */

export function normalizeProfileImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0]?.split("#")[0] ?? url;
  }
}

export function withProfileImageVersion(
  url: string,
  version: number | string = Date.now(),
): string {
  const base = normalizeProfileImageUrl(url);
  return `${base}?v=${version}`;
}

export function resolveProfileImageSrc(
  url: string | null | undefined,
  updatedAt?: Date | string | null,
): string {
  if (!url) return "";
  if (url.startsWith("blob:")) return url;
  if (/[?&]v=/.test(url)) return url;

  if (updatedAt) {
    const ts =
      updatedAt instanceof Date
        ? updatedAt.getTime()
        : new Date(updatedAt).getTime();
    if (!Number.isNaN(ts)) {
      return withProfileImageVersion(url, ts);
    }
  }

  return url;
}

const ALLOWED_MEDIA_PREFIXES = ["profiles/quiz/", "profiles/"] as const;

export function isAllowedQuizMediaKey(key: string): boolean {
  return ALLOWED_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Resolve a stored S3 URL to the in-app media proxy path. */
export function resolveQuizMediaSrc(url: string | null | undefined): string {
  if (!url?.trim()) return "";

  const trimmed = url.trim();
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const key = parsed.pathname.replace(/^\//, "").split("?")[0];
    if (
      key &&
      isAllowedQuizMediaKey(key) &&
      parsed.hostname.includes("amazonaws.com")
    ) {
      return `/api/quiz/v1/media?url=${encodeURIComponent(trimmed)}`;
    }
  } catch {
    // Fall through to direct URL
  }

  return trimmed;
}
