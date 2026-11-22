import { notFound, redirect } from "next/navigation";

import { WordWall } from "@/features/polls/components/word-wall";
import { getManagerPoll } from "@/features/polls/lib/manage-actions";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Live wall" };

export default async function PollWallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user || user.banned)
    redirect(`/auth/login?callbackUrl=/polls/${id}/wall`);

  const result = await getManagerPoll(id);
  if (!result.ok || result.data.questionType !== "short_answer") notFound();
  return <WordWall pollId={id} title={result.data.title} />;
}
