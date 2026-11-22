import Link from "next/link";
import { redirect } from "next/navigation";

import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user || user.banned) redirect("/auth/login?callbackUrl=/admin/users");
  if (!userCan(user, "access:manage-roles")) redirect("/dashboard");

  return (
    <div className="mx-auto mt-6 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decide who holds which role, and review sensitive activity.
          </p>
        </div>
        <nav className="flex gap-2">
          <Link
            href="/admin/users"
            className="peeerly-chip bg-card border px-4 py-2 text-sm"
          >
            Users & roles
          </Link>
          <Link
            href="/admin/audit"
            className="peeerly-chip bg-card border px-4 py-2 text-sm"
          >
            Audit log
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
