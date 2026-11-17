"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { getUser } from "@/actions/user";

import { type NavKey, activeNavKey, isImmersiveRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const desktopLinks: { key: NavKey; label: string; href: string }[] = [
  { key: "play", label: "Quiz", href: "/quiz" },
  { key: "experiences", label: "Placement Experiences", href: "/experiences" },
  { key: "share", label: "Share yours", href: "/experiences/new" },
];

export function PeeerlyLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Image
        src="/peeerly.svg"
        alt=""
        width={36}
        height={36}
        className="h-8 w-8 sm:h-9 sm:w-9"
        priority
      />
      <span className="font-serif text-xl font-bold tracking-tight sm:text-2xl">
        Peeerly
      </span>
    </span>
  );
}

const Navbar = () => {
  const pathname = usePathname();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: getUser,
    staleTime: 1000 * 60 * 5,
  });

  if (isImmersiveRoute(pathname)) return null;

  const active = activeNavKey(pathname);

  return (
    <header className="sticky top-0 z-40 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3">
      <nav className="bg-card/85 mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[1.4rem] border px-3 py-2 shadow-sm backdrop-blur-md sm:px-5 sm:py-2.5">
        <Link href={user ? "/dashboard" : "/"} aria-label="Peeerly home">
          <PeeerlyLogo />
        </Link>

        {/* Desktop links — on mobile these live in the bottom tab bar */}
        <ul className="hidden items-center gap-1 md:flex">
          {desktopLinks.map((link) => (
            <li key={link.key}>
              <Link
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  active === link.key
                    ? "bg-sky-soft text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {isLoading ? (
            <Skeleton className="h-9 w-9 rounded-full" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden rounded-full sm:inline-flex"
              >
                <Link href="/auth/login">Log in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-ink text-ink-foreground hover:bg-ink/90 rounded-full px-4"
              >
                <Link href="/auth/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
