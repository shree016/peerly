"use client";

import { useState } from "react";

import { useRouter } from "@bprogress/next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import {
  PASSWORD_RULE_HINT,
  PasswordInput,
} from "@/components/common/password-input";

import type { AppErrorBody } from "@/lib/app-error";

import { logout } from "@/actions/auth";
import { changePassword, setPassword } from "@/actions/password";

import { Loader } from "@/components/icons";

/**
 * "set": a Google account adding a password, so it can also log in with
 * email + password. "change": an account that already has one.
 */
export function PasswordDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "set" | "change";
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<AppErrorBody | null>(null);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }

  const save = useMutation({
    mutationFn: () =>
      mode === "set"
        ? setPassword({ newPassword, confirmPassword })
        : changePassword({ currentPassword, newPassword, confirmPassword }),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        mode === "set"
          ? "Password added. You can now log in with your email and password too."
          : "Password changed. Your other devices were logged out.",
      );
      reset();
      onOpenChange(false);
      router.refresh();
    },
    onError: () =>
      setError({
        code: "INTERNAL",
        message: "Something went wrong. Please try again.",
      }),
  });

  // Adding a password needs a recent login (see actions/password.ts).
  const loginAgain = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      router.push("/auth/login?callbackUrl=/profile");
    },
  });

  const busy = save.isPending || loginAgain.isPending;
  const canSubmit =
    newPassword && confirmPassword && (mode === "set" || currentPassword);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "set" ? "Set a password" : "Change password"}
          </DialogTitle>
          <DialogDescription>
            {mode === "set"
              ? "You log in with Google now. Add a password to also log in with your email, for example on a computer without your Google account."
              : "You'll stay logged in here. Every other device will be logged out."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="password-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutate();
          }}
          className="space-y-4"
        >
          {error && (
            <div className="border-destructive/20 bg-destructive/10 space-y-2 rounded-lg border p-3">
              <p className="text-destructive text-sm">{error.message}</p>
              {error.code === "LOGIN_AGAIN" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => loginAgain.mutate()}
                  disabled={busy}
                >
                  {loginAgain.isPending
                    ? "Logging out…"
                    : "Log out and log in again"}
                </Button>
              )}
            </div>
          )}

          {mode === "change" && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
                value={currentPassword}
                onChange={setCurrentPassword}
                disabled={busy}
                invalid={error?.field === "currentPassword"}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={busy}
            />
            <p className="text-muted-foreground text-xs">
              {PASSWORD_RULE_HINT}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmNewPassword">Type it again</Label>
            <PasswordInput
              id="confirmNewPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={busy}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="password-form"
            disabled={busy || !canSubmit}
          >
            {save.isPending && <Loader />}
            {save.isPending ? "Saving…" : "Save password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
