import { redirect } from "next/navigation";

import { ExperienceForm } from "@/features/experiences/components/experience-form";
import { ExperiencesBackLink } from "@/features/experiences/components/experiences-back-link";
import { getExperienceTemplates } from "@/features/experiences/lib/actions";

import { getUser } from "@/actions/user";

export default async function NewExperiencePage() {
  // Renders in parallel with the experiences layout, so check the session
  // here too — getExperienceTemplates() throws "Unauthorized" without one.
  const user = await getUser();
  if (!user) redirect("/auth/login?callbackUrl=/experiences/new");

  const templates = await getExperienceTemplates();

  return (
    <div className="container mx-auto mt-4 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6 md:mb-32">
      <ExperiencesBackLink />
      <ExperienceForm templates={templates} />
    </div>
  );
}
