import { redirect } from "next/navigation";

import { ManagerPollsHome } from "@/features/polls/components/manager-polls-home";
import { StudentPollsHome } from "@/features/polls/components/student-polls-home";

import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Polls" };

export default async function PollsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tab?: string }>;
}) {
  const user = await getUser();
  if (!user || user.banned) redirect("/auth/login?callbackUrl=/polls");

  const { view, tab } = await searchParams;
  const canManage = userCan(user, "poll:manage");

  // Managers can switch to the plain student view ("Preview as student")
  // to answer polls aimed at them, exactly as students see them.
  if (canManage && view !== "student") {
    return (
      <ManagerPollsHome
        initialTab={tab === "seatlock" ? "seatlock" : "quick"}
        canEditRoster={userCan(user, "roster:write")}
      />
    );
  }

  return <StudentPollsHome isManager={canManage} />;
}
