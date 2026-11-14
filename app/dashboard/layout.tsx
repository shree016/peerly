import { redirect } from "next/navigation";

import { EmailVerificationRequired } from "@/components/common/email-verification-required";

import { getUser } from "@/actions/user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) redirect("/auth/login?callbackUrl=/dashboard");
  if (!user.emailVerified) return <EmailVerificationRequired />;

  return <>{children}</>;
}
