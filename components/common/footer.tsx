"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isImmersiveRoute } from "@/lib/navigation";

import { PeeerlyLogo } from "./navbar";

const Footer = () => {
  const pathname = usePathname();
  if (isImmersiveRoute(pathname)) return null;

  return (
    <footer className="px-4 pt-16 pb-8 sm:px-6">
      <div className="peeerly-card mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-1">
          <PeeerlyLogo className="justify-center sm:justify-start" />
          <p className="text-muted-foreground text-sm">
            Learn together. Play together. Get placed together.
          </p>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium">
          <li>
            <Link href="/quiz/join" className="text-muted-foreground hover:text-foreground">
              Join a quiz
            </Link>
          </li>
          <li>
            <Link href="/experiences" className="text-muted-foreground hover:text-foreground">
              Placement experiences
            </Link>
          </li>
          <li className="text-muted-foreground">© {new Date().getFullYear()} Peeerly</li>
        </ul>
      </div>
    </footer>
  );
};

export default Footer;
