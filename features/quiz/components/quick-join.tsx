"use client";

import { type FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";

import { cn } from "@/lib/utils";

/**
 * Inline "enter join code" pill used on the landing page and dashboard.
 * Same lookup as /quiz/join, then forwards to the name/avatar step.
 */
export function QuickJoin({ className }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      toast.error("Join codes are 6 characters long.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/quiz/v1/sessions/by-join-code?code=${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) {
        toast.error(
          res.status === 404
            ? "No live quiz found for that code."
            : "Couldn't look up that code. Try again.",
        );
        return;
      }
      router.push(`/quiz/join/${trimmed}`);
    } catch {
      toast.error("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "bg-card flex w-full max-w-sm items-center gap-1 rounded-full border p-1.5 shadow-md",
        className,
      )}
    >
      <label htmlFor="quick-join-code" className="sr-only">
        Quiz join code
      </label>
      <input
        id="quick-join-code"
        value={code}
        onChange={(e) =>
          setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
        }
        maxLength={6}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="Join code"
        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-4 font-mono text-base font-bold tracking-[0.2em] uppercase outline-none placeholder:font-sans placeholder:font-medium placeholder:tracking-normal"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || code.length === 0}
        className="bg-ink text-ink-foreground flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
      >
        {loading ? <Spinner size="sm" className="text-ink-foreground" /> : <>Join <ArrowRight className="size-4" /></>}
      </button>
    </form>
  );
}
