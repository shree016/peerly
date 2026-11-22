import { redirect } from "next/navigation";

import { getUser } from "@/actions/user";

/**
 * Real session check for every /experiences page. The proxy only checks that
 * a session cookie is *present*, so without this an expired, revoked or fake
 * cookie could read experiences (and /experiences/new crashed with a 500).
 */
export default async function ExperiencesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user || user.banned) redirect("/auth/login?callbackUrl=/experiences");

  return <>{children}</>;
}
