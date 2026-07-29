import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, KeyRound, Languages, Loader2, Radar, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { applyBrandColor, publicBrandingQuery } from "@/features/platform/branding";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — AegisIQ CX™ Intelligence Console" },
      {
        name: "description",
        content:
          "Secure company sign-in for AegisIQ CX™, the AI customer experience intelligence platform for multi-site enterprises.",
      },
      { property: "og:title", content: "Sign in — AegisIQ CX™ Intelligence Console" },
      {
        property: "og:description",
        content:
          "Secure company sign-in for AegisIQ CX™, the AI customer experience intelligence platform for multi-site enterprises.",
      },
    ],
  }),
  component: SignInPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email({ message: "Enter a valid work email" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(72),
});

const HIGHLIGHTS = [
  {
    icon: Radar,
    title: "Conversation intelligence at estate scale",
    body: "Every customer interaction across outlets becomes searchable, scored and auditable.",
  },
  {
    icon: Building2,
    title: "Multi-tenant by design",
    body: "Hard tenant isolation with row-level security, regional hierarchies and delegated administration.",
  },
  {
    icon: Languages,
    title: "Multilingual by default",
    body: "English, Arabic, French, Spanish, Hindi and Mandarin analysed in one operating picture.",
  },
];

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [pending, setPending] = useState(false);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [ssoDomain, setSsoDomain] = useState("");

  // Tenant branding is exposed through a read-only database function that
  // returns presentation fields only — no tenant data leaves RLS.
  const { data: branding } = useQuery(publicBrandingQuery);
  useEffect(() => {
    applyBrandColor(branding?.brand_primary_color);
  }, [branding?.brand_primary_color]);

  // OAuth (Google / SSO) returns to this page as a full-page redirect. Once the
  // session lands, move the user straight into the console instead of showing
  // the sign-in form again.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate({ to: "/command-centre", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/command-centre", replace: true });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setPending(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        toast.success("Welcome back to AegisIQ CX™");
        navigate({ to: "/command-centre" });
      } else {
        const { error } = await supabase.auth.signUp({
          ...parsed.data,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() || undefined },
          },
        });
        if (error) throw error;
        toast.success("Workspace account created. You can sign in now.");
        setMode("signin");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setPending(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/signin`,
    });
    if (result.error) {
      setPending(false);
      toast.error("Google sign-in is unavailable right now");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/command-centre" });
  }

  /**
   * Enterprise SSO (SAML / OIDC). Supabase resolves the tenant's identity
   * provider from the email domain and returns the redirect URL; RLS and the
   * tenant guard still apply once the session lands.
   */
  async function handleSso(event: React.FormEvent) {
    event.preventDefault();
    const domain = ssoDomain.trim().toLowerCase().replace(/^@/, "");
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      toast.error("Enter your company email domain, e.g. company.com");
      return;
    }
    setPending(true);
    try {
      const { data, error } = await supabase.auth.signInWithSSO({
        domain,
        options: { redirectTo: `${window.location.origin}/signin` },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      toast.error("No identity provider is registered for that domain");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Single sign-on is unavailable for that domain",
      );
    } finally {
      setPending(false);
    }
  }

  const brandName = branding?.name ?? "AegisIQ CX™";
  const brandTagline = branding?.brand_tagline ?? "AI Customer Experience Intelligence Platform";

  return (
    <div className="auth-backdrop grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between border-r border-border px-12 py-14 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt={`${brandName} logo`}
                className="size-full object-contain"
              />
            ) : (
              <img
                src="/aegisiqcx-icon-192.png"
                alt="AegisIQ CX"
                className="size-5 object-contain"
              />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">{brandName}</p>
            <p className="text-[11px] text-muted-foreground">{brandTagline}</p>
          </div>
        </div>

        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Turn every customer conversation into{" "}
            <span className="brand-gradient-text">operational intelligence</span>.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            AegisIQ CX™ ingests CCTV audio and front-line conversations across retail, banking,
            healthcare, government and hospitality estates — then converts them into sentiment, risk
            and revenue signals your executives can act on.
          </p>

          <div className="mt-10 space-y-5">
            {HIGHLIGHTS.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
                className="flex gap-4"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-primary ring-1 ring-border">
                  <item.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          ISO 27001 aligned · Row-level tenant isolation · Regional data residency ready
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="panel w-full max-w-md p-7"
        >
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid size-9 place-items-center overflow-hidden rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              {branding?.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={`${brandName} logo`}
                  className="size-full object-contain"
                />
              ) : (
                <ShieldCheck className="size-4" />
              )}
            </span>
            <span className="text-sm font-semibold">{brandName}</span>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Company sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Access your tenant workspace with your corporate credentials.
          </p>

          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "signin" | "signup")}
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2 bg-surface">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Request workspace</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <TabsContent value="signup" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    maxLength={100}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="bg-surface"
                  />
                </div>
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  maxLength={255}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="bg-surface"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary transition-colors hover:text-primary-glow"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  maxLength={72}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-surface"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {mode === "signin" ? "Sign in to console" : "Create workspace account"}
              </Button>
            </form>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={pending}>
              Continue with Google Workspace
            </Button>

            {ssoOpen ? (
              <form
                onSubmit={handleSso}
                className="space-y-3 rounded-xl border border-border bg-surface/60 p-4"
              >
                <Label htmlFor="ssoDomain" className="text-xs">
                  Company email domain
                </Label>
                <Input
                  id="ssoDomain"
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  placeholder="company.com"
                  maxLength={253}
                  className="bg-background"
                  autoComplete="organization"
                />
                <p className="text-[11px] text-muted-foreground">
                  We redirect you to your organisation's SAML or OIDC identity provider. Tenant
                  isolation is enforced by row-level security after sign-in.
                </p>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={pending}>
                    {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Continue with SSO
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setSsoOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSsoOpen(true)}
                disabled={pending}
              >
                <KeyRound className="mr-2 size-4" /> Enterprise single sign-on (SAML / OIDC)
              </Button>
            )}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            Sessions are protected with rotating tokens and full audit logging. Unauthorised access
            attempts are recorded against your tenant.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
