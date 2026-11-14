"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  House,
  type LucideIcon,
  PenLine,
  Play,
  UserRound,
} from "lucide-react";

import { getUser } from "@/actions/user";

import { type NavKey, activeNavKey, isImmersiveRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Mobile-only bottom tab bar (hidden at md and up, where the top navbar shows
 * the same links). Mirrors the reference design: a floating white dock with
 * the active tab rendered as a filled periwinkle pill.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: getUser,
    staleTime: 1000 * 60 * 5,
  });

  if (isImmersiveRoute(pathname)) return null;

  const active = activeNavKey(pathname);

  const tabs: Tab[] = [
    { key: "home", label: "Home", href: user ? "/dashboard" : "/", icon: House },
    { key: "play", label: "Play", href: "/quiz/join", icon: Play },
    {
      key: "experiences",
      label: "Placements",
      href: "/experiences",
      icon: BriefcaseBusiness,
    },
    { key: "share", label: "Share", href: "/experiences/new", icon: PenLine },
    {
      key: "profile",
      label: "Profile",
      href: user ? "/profile" : "/auth/login",
      icon: UserRound,
    },
  ];

  return (
    <>
      {/* Spacer so page content never hides behind the fixed dock */}
      <div aria-hidden className="h-28 md:hidden" />

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <ul className="bg-card/95 mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[1.75rem] border p-1.5 shadow-xl backdrop-blur-md">
          {tabs.map((tab) => {
            const isActive = active === tab.key;
            const Icon = tab.icon;
            return (
              <li key={tab.key} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.35rem] px-1 text-[0.68rem] font-semibold transition-all duration-200",
                    isActive
                      ? "bg-sky text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground active:scale-95",
                  )}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={isActive ? 2.4 : 2}
                    aria-hidden
                  />
                  <span className="leading-none">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
