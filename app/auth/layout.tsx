import { HeroIllustration } from "@/features/landing/components/hero-illustration";

/**
 * Shared frame for login / signup: the Peeerly illustration on the left at
 * desktop widths, a slimmer banner on top at phone widths, form on the right.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pt-4 pb-10 sm:px-6 md:min-h-[calc(100dvh-10rem)] md:grid-cols-2 md:gap-12 md:pt-8">
      <HeroIllustration
        compact
        className="mx-auto w-full max-w-[17rem] sm:max-w-sm md:max-w-none"
        title={["Smart play", "wins."]}
        caption="Learn fast, think smart, win every challenge."
      />
      <div className="w-full">{children}</div>
    </div>
  );
}
