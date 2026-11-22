import { redirect } from "next/navigation";

import { CreatePollForm } from "@/features/polls/components/create-poll-form";

import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

export const metadata = { title: "New poll" };

export default async function NewPollPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const user = await getUser();
  if (!user || user.banned) redirect("/auth/login?callbackUrl=/polls/new");
  if (!userCan(user, "poll:manage")) redirect("/polls");

  const { kind } = await searchParams;
  return <CreatePollForm kind={kind === "seatlock" ? "seatlock" : "quick"} />;
}
