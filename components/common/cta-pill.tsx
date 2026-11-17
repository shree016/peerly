import Link from "next/link";

import { ChevronsRight, Lightbulb, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The big "Get Started" pill from the Peeerly onboarding screen: deep-ink
 * capsule, periwinkle icon puck on the left, label centred, chevrons right.
 */
export function CtaPill({
  href,
  label,
  icon: Icon = Lightbulb,
  className,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group bg-ink text-ink-foreground relative flex h-16 w-full max-w-sm items-center rounded-full p-1.5 pr-5 shadow-xl transition active:scale-[0.98]",
        className,
      )}
    >
      <span className="bg-sky flex size-13 shrink-0 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:translate-x-1">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex-1 text-center text-base font-semibold">{label}</span>
      <ChevronsRight
        className="size-5 opacity-60 transition-transform group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}
