"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

import { unwrap } from "@/lib/app-error";
import { EMAIL_DOMAIN_RESTRICTED, EMAIL_PLACEHOLDER } from "@/lib/email-policy";

import { requestPasswordReset } from "@/actions/password";

import { Loader, Mail } from "@/components/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  const { mutate, isPending, error, data } = useMutation({
    mutationFn: async (value: string) =>
      unwrap(await requestPasswordReset({ email: value })),
  });

  return (
    <div className="flex w-full items-center justify-center">
      <div className="flex w-full flex-col items-center gap-4">
        <div className="text-center">
          <span className="peeerly-chip bg-sun-soft border-sun/50 border">
            🔑 Forgot password
          </span>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
            Set a new <span className="text-primary">password</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            We&apos;ll email you a link to choose a new password. This also
            works if you signed up with Google and want a password too.
          </p>
        </div>
        <Card className="w-full max-w-md border-white/70 lg:mt-2 dark:border-white/5">
          <CardContent className="space-y-4">
            {data ? (
              <div
                role="status"
                className="border-primary/20 bg-primary/10 rounded-lg border p-4"
              >
                <p className="text-sm">{data.message}</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(email);
                }}
                className="space-y-4"
              >
                {error && (
                  <div className="border-destructive/20 bg-destructive/10 rounded-lg border p-4">
                    <p className="text-destructive text-sm">{error.message}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>
                        <Mail />
                      </InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={EMAIL_PLACEHOLDER}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isPending}
                    />
                  </InputGroup>
                  {EMAIL_DOMAIN_RESTRICTED && (
                    <p className="text-muted-foreground text-xs">
                      Use your college email ({EMAIL_PLACEHOLDER.split("@")[1]}
                      ).
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isPending || !email.trim()}
                >
                  {isPending && <Loader />}
                  {isPending ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            )}

            <div className="text-center text-sm">
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
