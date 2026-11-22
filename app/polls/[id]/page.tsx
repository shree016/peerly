import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PollManager } from "@/features/polls/components/poll-manager";
import { PollRespond } from "@/features/polls/components/poll-respond";
import { getManagerPoll } from "@/features/polls/lib/manage-actions";
import { getStudentPoll } from "@/features/polls/lib/student-actions";

import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Poll" };

export default async function PollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const user = await getUser();
  if (!user || user.banned) redirect(`/auth/login?callbackUrl=/polls/${id}`);

  const canManage = userCan(user, "poll:manage");
  if (canManage && view !== "student") {
    const managed = await getManagerPoll(id);
    if (managed.ok) {
      return (
        <PollManager
          initial={managed.data}
          canWriteRoster={userCan(user, "roster:write")}
        />
      );
    }
  }

  const result = await getStudentPoll(id);
  if (!result.ok) {
    // A manager previewing a poll aimed at other students: explain instead of
    // a bare 404. Real students always get the 404 (no existence leak).
    if (canManage && view === "student" && (await getManagerPoll(id)).ok) {
      return (
        <div className="mx-auto mt-10 max-w-lg px-4 text-center">
          <p className="peeerly-card p-6 text-sm">
            You&apos;re not in this poll&apos;s audience (or it&apos;s still a
            draft), so as a student you wouldn&apos;t see it at all.
          </p>
          <Link
            href={`/polls/${id}`}
            className="mt-4 inline-block text-sm font-semibold underline"
          >
            Back to managing this poll
          </Link>
        </div>
      );
    }
    notFound();
  }
  return <PollRespond initial={result.data} isManager={canManage} />;
}
