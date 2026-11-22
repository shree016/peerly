import { redirect } from "next/navigation";

import { DriveTemplatesManager } from "@/features/experiences/components/drive-templates-manager";
import { listDriveTemplates } from "@/features/experiences/lib/template-actions";

import { userCan } from "@/lib/permissions/server";

import { getUser } from "@/actions/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Drive templates" };

export default async function DriveTemplatesPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login?callbackUrl=/experiences/templates");
  if (!userCan(user, "experience:templates")) redirect("/experiences");

  const result = await listDriveTemplates();
  if (!result.ok) redirect("/experiences");

  return <DriveTemplatesManager initial={result.data} />;
}
