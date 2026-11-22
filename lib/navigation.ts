/**
 * Shared navigation config for the desktop navbar and the mobile bottom tab bar.
 */

/** Routes that take over the whole screen (live quiz play / presenter view, poll word wall). */
const IMMERSIVE_PATTERNS = [
  /^\/quiz\/play\//,
  /^\/quiz\/sessions\/[^/]+\/present/,
  /^\/polls\/[^/]+\/wall/,
];

export function isImmersiveRoute(pathname: string): boolean {
  return IMMERSIVE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export type NavKey =
  "home" | "play" | "polls" | "experiences" | "profile" | "admin";

export function activeNavKey(pathname: string): NavKey | null {
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "home";
  if (pathname.startsWith("/quiz")) return "play";
  if (pathname.startsWith("/polls")) return "polls";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/experiences")) return "experiences";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}
