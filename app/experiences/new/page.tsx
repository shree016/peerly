import { ExperienceForm } from "@/features/experiences/components/experience-form";
import { ExperiencesBackLink } from "@/features/experiences/components/experiences-back-link";

export default function NewExperiencePage() {
  return (
    <div className="container mx-auto mt-4 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6 md:mb-32">
      <ExperiencesBackLink />
      <ExperienceForm />
    </div>
  );
}
