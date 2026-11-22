/**
 * The profile form shows "github.com/ [username]", but the database stores
 * full links. These helpers accept either (plus "@username" and pasted links
 * with or without https) and convert between the two.
 */
const NETWORKS = {
  github: {
    base: "https://github.com/",
    host: /^(www\.)?github\.com$/,
    username: /^[a-z\d][a-z\d-]{0,38}$/i,
  },
  twitter: {
    base: "https://x.com/",
    host: /^((www|mobile)\.)?(x|twitter)\.com$/,
    username: /^\w{1,15}$/,
  },
  linkedin: {
    base: "https://www.linkedin.com/in/",
    // Regional links such as in.linkedin.com are common.
    host: /^([a-z]{2,3}\.|m\.)?linkedin\.com$/,
    username: /^[\p{L}\p{M}\p{N}_-]{3,100}$/u,
  },
} as const;

export type SocialNetwork = keyof typeof NETWORKS;

function usernameFromLink(network: SocialNetwork, link: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    if (!NETWORKS[network].host.test(url.hostname)) return null;

    const path = url.pathname.split("/").filter(Boolean);
    // LinkedIn profiles live under /in/ and may have a sub-page after the name.
    if (network === "linkedin") {
      return path[0] === "in" && path[1] ? decodeURIComponent(path[1]) : null;
    }
    // Exactly one segment, so repository and post links are rejected.
    return path.length === 1 && path[0] ? decodeURIComponent(path[0]) : null;
  } catch {
    return null; // malformed link or percent-encoding
  }
}

/** The username in a typed value or link, or null if it isn't a valid one. */
export function socialUsername(
  network: SocialNetwork,
  value: string | null | undefined,
): string | null {
  const input = value?.trim();
  if (!input) return null;

  const candidate = input.includes("/")
    ? usernameFromLink(network, input)
    : input;
  const username = candidate?.replace(/^@/, "");

  return username && NETWORKS[network].username.test(username)
    ? username
    : null;
}

/** The full link to store, or "" when there is no valid username. */
export function socialUrl(
  network: SocialNetwork,
  value: string | null | undefined,
): string {
  const username = socialUsername(network, value);
  return username
    ? `${NETWORKS[network].base}${encodeURIComponent(username)}`
    : "";
}
