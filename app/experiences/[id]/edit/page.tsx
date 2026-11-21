import { notFound } from "next/navigation";

import { ExperienceForm } from "@/features/experiences/components/experience-form";
import { ExperiencesBackLink } from "@/features/experiences/components/experiences-back-link";
import { getExperience } from "@/features/experiences/lib/actions";
import { experienceToFormInput } from "@/features/experiences/lib/experience-form-input";

import { getUser } from "@/actions/user";

export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [experience, currentUser] = await Promise.all([
    getExperience(id),
    getUser(),
  ]);

  if (!experience) notFound();
  if (!currentUser || currentUser.id !== experience.authorId) notFound();

  return (
    <div className="container mx-auto mt-4 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6 md:mb-32">
      <ExperiencesBackLink />
      <ExperienceForm
        experienceId={id}
        initialData={experienceToFormInput(experience)}
      />
    </div>
  );
}
