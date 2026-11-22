import { redirect } from "next/navigation";

import { getUser } from "@/actions/user";

/**
 * Sends visitors without a valid session to login. NOT the security boundary:
 * Next skips layouts on client-side navigation and renders them in parallel
 * with the page. The data is protected by `requireExperienceReader` in
 * features/experiences/lib/actions.ts.
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
