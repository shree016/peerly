import { UsersAdmin } from "@/features/admin/components/users-admin";

import { getUser } from "@/actions/user";

export const metadata = { title: "Users & roles" };

export default async function AdminUsersPage() {
  const me = (await getUser())!; // admin layout guarantees a signed-in admin
  return <UsersAdmin currentUserId={me.id} />;
}
