import { HeroIllustration } from "@/features/landing/components/hero-illustration";

/**
 * Shared frame for login / signup: the Peeerly illustration on the left at
 * desktop widths, form on the right. On phones the illustration is dropped so
 * the form sits in the first screen instead of below a tall banner.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-4 pt-6 pb-10 sm:px-6 md:min-h-[calc(100dvh-10rem)] md:grid-cols-2 md:gap-12 md:pt-8">
      <HeroIllustration
        compact
        className="hidden w-full md:block"
        title={["Smart play", "wins."]}
        caption="Learn fast, think smart, win every challenge."
      />
      <div className="w-full">{children}</div>
    </div>
  );
}
