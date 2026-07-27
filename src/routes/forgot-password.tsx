import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset access — AegisIQ CX™" },
      {
        name: "description",
        content:
          "Request a secure password reset link for your AegisIQ CX™ tenant workspace account.",
      },
      { property: "og:title", content: "Reset access — AegisIQ CX™" },
      {
        property: "og:description",
        content: "Request a secure password reset link for your AegisIQ CX™ workspace account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid work email");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset instructions sent");
  }

  return (
    <div className="auth-backdrop flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="panel w-full max-w-md p-7">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
          <ShieldCheck className="size-5" />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Reset workspace access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll email a single-use recovery link to your registered corporate address.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            If an account exists for {email}, a recovery link is on its way. The link expires in 60
            minutes.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                maxLength={255}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-surface"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send recovery link
            </Button>
          </form>
        )}

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
