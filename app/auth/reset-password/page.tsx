"use client";

import { Suspense, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useRouter } from "@bprogress/next";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import {
  PASSWORD_RULE_HINT,
  PasswordInput,
} from "@/components/common/password-input";

import { unwrap } from "@/lib/app-error";

import { resetPassword } from "@/actions/password";

import { Loader } from "@/components/icons";

function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Better Auth sends people here with ?token=… or, for a dead link, ?error=INVALID_TOKEN.
  const token = searchParams.get("token") ?? "";
  const linkBroken = !token || searchParams.has("error");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () =>
      unwrap(await resetPassword({ token, newPassword, confirmPassword })),
    onSuccess: () => router.replace("/auth/login?reset=done"),
  });

  return (
    <div className="flex w-full items-center justify-center">
      <div className="flex w-full flex-col items-center gap-4">
        <div className="text-center">
          <span className="peeerly-chip bg-sun-soft border-sun/50 border">
            🔑 New password
          </span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Choose a new <span className="text-primary">password</span>
          </h1>
        </div>
        <Card className="w-full max-w-md border-white/70 lg:mt-2 dark:border-white/5">
          <CardContent className="space-y-4">
            {linkBroken ? (
              <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-4">
                <p className="text-destructive text-sm">
                  This reset link has expired or was already used.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate();
                }}
                className="space-y-4"
              >
                {error && (
                  <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-4">
                    <p className="text-destructive text-sm">{error.message}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <PasswordInput
                    id="newPassword"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    disabled={isPending}
                  />
                  <p className="text-muted-foreground text-xs">
                    {PASSWORD_RULE_HINT}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Type it again</Label>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    disabled={isPending}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  You&apos;ll be logged out on every device, then you can log in
                  with the new password.
                </p>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending || !newPassword || !confirmPassword}
                >
                  {isPending && <Loader />}
                  {isPending ? "Saving…" : "Save new password"}
                </Button>
              </form>
            )}

            <div className="flex justify-center gap-4 text-sm">
              {linkBroken && (
                <Link
                  href="/auth/forgot-password"
                  className="text-primary font-medium hover:underline"
                >
                  Get a new link
                </Link>
              )}
              <Link
                href="/auth/login"
                className="text-primary font-medium hover:underline"
              >
                Back to log in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
