"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!email.trim() || !password) {
      toast.error("Enter email and password");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
        return;
      }

      // Full navigation so the session cookie is picked up on tunnel hosts.
      const callbackUrl = searchParams.get("callbackUrl") || "/";
      window.location.assign(callbackUrl);
    } catch {
      toast.error("Sign-in failed. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      method="post"
      action="#"
      onSubmit={onSubmit}
      className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
      noValidate
    >
      <p className="mb-5 text-sm text-muted-foreground">
        Sign in with your ADMIN or STAFF account
      </p>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="staff@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-base md:h-10 md:text-sm"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 text-base md:h-10 md:text-sm"
            required
          />
        </div>

        <Button
          type="submit"
          className="mt-1 h-11 w-full text-base md:h-10 md:text-sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
