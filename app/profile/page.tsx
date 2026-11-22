import Link from "next/link";
import { redirect } from "next/navigation";

import { ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { RankRow } from "@/components/common/podium";

import { CompanyAvatar } from "@/features/experiences/components/company-avatar";
import { getAllExperiences } from "@/features/experiences/lib/actions";
import { ProfileActions } from "@/features/profile/components/profile-actions";
import { getUser } from "@/actions/user";

import { ROLE_LABELS } from "@/lib/permissions/roles";
import { getEffectiveRoles } from "@/lib/permissions/server";
import { resolveProfileImageSrc } from "@/lib/s3/profile-image";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/auth/login?callbackUrl=/profile");

  const mine = (await getAllExperiences().catch(() => [])).filter(
    (e) => e.authorId === user.id,
  );

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || user.email[0].toUpperCase();

  const roles = getEffectiveRoles(user)
    .filter((r) => r !== "student")
    .map((r) => ROLE_LABELS[r]);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 sm:px-6 sm:pt-8">
      <section className="peeerly-rays peeerly-card flex flex-col items-center px-6 pt-8 pb-6 text-center">
        <Avatar className="border-sky-soft size-24 border-[6px] shadow-md">
          <AvatarImage src={resolveProfileImageSrc(user.image, user.updatedAt)} alt="" />
          <AvatarFallback className="bg-sky-soft text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <h1 className="mt-3 text-2xl font-bold">{user.name ?? "Peeerly member"}</h1>
        <p className="text-muted-foreground max-w-full truncate text-sm">{user.email}</p>
        {user.bio && <p className="mt-2 max-w-md text-sm">{user.bio}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <span className="peeerly-chip bg-sun text-black">💎 {mine.length} shared</span>
          {(roles.length ? roles : ["Student"]).map((role) => (
            <span key={role} className="peeerly-chip bg-sky-soft">
              {role}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Settings</h2>
        <ProfileActions user={user} />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">My placement stories</h2>
          <Link href="/experiences/new" className="text-primary text-sm font-semibold">
            + Share
          </Link>
        </div>
        {mine.length === 0 ? (
          <p className="bg-candy-soft rounded-3xl p-6 text-center text-sm">
            You haven&apos;t shared an experience yet.
          </p>
        ) : (
          <div className="space-y-2">
            {mine.map((exp, i) => (
              <Link key={exp.id} href={`/experiences/${exp.id}`} className="block">
                <RankRow
                  rank={i + 1}
                  avatar={
                    <CompanyAvatar
                      companyName={exp.companyName}
                      logoUrl={exp.companyLogoUrl}
                      size="size-11 rounded-full text-base"
                    />
                  }
                  name={exp.companyName}
                  subtitle={`${exp.role} · ${exp.result}`}
                  trailing={<ChevronRight className="text-muted-foreground size-5" />}
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
