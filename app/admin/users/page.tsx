import { redirect } from "next/navigation";

import { UsersAdmin } from "@/features/admin/components/users-admin";

import { getUser } from "@/actions/user";

export const metadata = { title: "Users & roles" };

export default async function AdminUsersPage() {
  // Next renders this page in parallel with the admin layout, so the layout's
  // redirect doesn't stop this code from running — handle "no user" here too.
  const me = await getUser();
  if (!me) redirect("/auth/login?callbackUrl=/admin/users");
  return <UsersAdmin currentUserId={me.id} />;
}
