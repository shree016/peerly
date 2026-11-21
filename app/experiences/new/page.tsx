import { ExperienceForm } from "@/features/experiences/components/experience-form";
import { ExperiencesBackLink } from "@/features/experiences/components/experiences-back-link";
import { getExperienceTemplates } from "@/features/experiences/lib/actions";

export default async function NewExperiencePage() {
  const templates = await getExperienceTemplates();

  return (
    <div className="container mx-auto mt-4 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6 md:mb-32">
      <ExperiencesBackLink />
      <ExperienceForm templates={templates} />
    </div>
  );
}
