import { redirect } from "next/navigation";

import { RosterManager } from "@/features/polls/components/roster-manager";

import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Student roster" };

export default async function RosterPage() {
  const user = await getUser();
  if (!user || user.banned) redirect("/auth/login?callbackUrl=/polls/roster");
  if (!userCan(user, "roster:read")) redirect("/polls");

  return (
    <RosterManager
      canWrite={userCan(user, "roster:write")}
      canExport={userCan(user, "roster:export")}
    />
  );
}
