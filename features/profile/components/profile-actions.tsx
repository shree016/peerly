"use client";

import { useState } from "react";

import { useRouter } from "@bprogress/next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, PenLine, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { ProfileDialog } from "@/features/profile/components/profile-dialog";

import { logout } from "@/actions/auth";

import type { User } from "@/types";

const rowClass =
  "bg-card flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold shadow-xs transition active:scale-[0.99] hover:bg-muted";

export function ProfileActions({ user }: { user: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const [editOpen, setEditOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.push("/auth/login");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to log out"),
  });

  const isDark = resolvedTheme === "dark";

  return (
    <>
      <ProfileDialog open={editOpen} onOpenChange={setEditOpen} user={user} />
      <div className="space-y-2">
        <button type="button" className={rowClass} onClick={() => setEditOpen(true)}>
          <span className="bg-sky-soft flex size-9 items-center justify-center rounded-xl">
            <PenLine className="size-4" />
          </span>
          Edit profile
        </button>
        <button
          type="button"
          className={rowClass}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <span className="bg-sun-soft flex size-9 items-center justify-center rounded-xl">
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </span>
          {isDark ? "Switch to light mode" : "Switch to dark mode"}
        </button>
        <button
          type="button"
          className={`${rowClass} text-destructive`}
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <span className="bg-candy-soft flex size-9 items-center justify-center rounded-xl">
            <LogOut className="size-4" />
          </span>
          {logoutMutation.isPending ? "Logging out…" : "Log out"}
        </button>
      </div>
    </>
  );
}
