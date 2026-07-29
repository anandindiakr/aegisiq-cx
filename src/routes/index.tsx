import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Languages,
  Radar,
  ServerCog,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AegisIQ CX™ — AI Customer Experience Intelligence for Retail" },
      {
        name: "description",
        content:
          "AegisIQ CX™ turns front-line conversations into sentiment, service and revenue intelligence for multi-site retail and enterprise operations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "AegisIQ CX™ — AI Customer Experience Intelligence" },
      {
        property: "og:description",
        content:
          "Conversation intelligence, live alerting and executive analytics for retail estates — in one enterprise console.",
      },
    ],
  }),
  component: HomePage,
});

const MODULES = [
  {
    icon: BarChart3,
    title: "Executive Command Centre",
    body: "One landing view for CX score, sentiment, outlet ranking, live alerts and AI recommendations — filtered by region, outlet or period.",
  },
  {
    icon: Radar,
    title: "ConversationIQ™",
    body: "Every customer interaction transcribed, translated, scored and searchable, with review queues, SLA policies and redaction controls.",
  },
  {
    icon: Bot,
    title: "Aegis Copilot™",
    body: "Ask questions in plain language or by voice: “show me yesterday's complaints in Dubai Mall” returns a structured, auditable answer.",
  },
  {
    icon: ShieldCheck,
    title: "Live Monitor & Alert Centre",
    body: "Real-time alerts with SLA timers, automatic escalation to backup owners, one-click conversation replay and MTTA/MTTR analytics.",
  },
  {
    icon: ServerCog,
    title: "Infrastructure Management",
    body: "Cameras, AI edge gateways, speech engines, audio pipelines, network and storage health — managed like an IoT estate.",
  },
  {
    icon: Building2,
    title: "Multi-tenant governance",
    body: "Row-level tenant isolation, role templates, SSO claim mapping, branding controls and a complete audit trail.",
  },
];

const ADVANTAGES = [
  {
    icon: Clock,
    title: "Hours back every week",
    body: "No more spot-checking recordings or chasing store managers for context. Issues surface themselves, ranked by impact.",
  },
  {
    icon: TrendingUp,
    title: "Revenue you were losing quietly",
    body: "Upsell misses, stock-out complaints and queue frustration are detected across every outlet, not just the ones head office visits.",
  },
  {
    icon: Languages,
    title: "Every language, one picture",
    body: "English, Arabic, French, Spanish, Hindi and Mandarin conversations are analysed together, so nothing is lost in translation.",
  },
  {
    icon: Sparkles,
    title: "Decisions, not dashboards",
    body: "AI summaries and recommendations tell you what changed, why it changed, and the next best action for each outlet.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Connect what you already have",
    body: "Existing CCTV audio, cameras and edge devices from Hikvision, Axis, Bosch, Hanwha and others onboard through a guided wizard.",
  },
  {
    step: "02",
    title: "AI does the listening",
    body: "Speech, diarisation, translation, sentiment and keyword engines process interactions continuously at the edge and in the cloud.",
  },
  {
    step: "03",
    title: "Your team acts",
    body: "Alerts route to the right owner with SLA timers, executives get scheduled reports, and every action is logged for compliance.",
  },
];

const OUTCOMES = [
  "Cut complaint response time from days to minutes",
  "Rank every outlet on a comparable CX score",
  "Prove service standards with evidence, not opinion",
  "Give regional managers a single weekly briefing",
  "Meet audit and privacy requirements with redaction",
  "Scale from 5 stores to 500 without new headcount",
];

function HomePage() {
  return (
    <div className="auth-backdrop min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center overflow-hidden rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <img
                src="/aegisiqcx-icon-192.png"
                alt="AegisIQ CX"
                className="size-5 object-contain"
              />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">AegisIQ CX™</p>
              <p className="text-[11px] text-muted-foreground">
                AI Customer Experience Intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signin">
                Open console <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:py-28">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <Sparkles className="size-3 text-primary" /> Enterprise CX intelligence
            </span>
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Every customer conversation, turned into{" "}
              <span className="brand-gradient-text">operational intelligence</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              AegisIQ CX™ listens across your retail estate — stores, branches, counters and
              service desks — and converts front-line interactions into sentiment, risk and revenue
              signals your executives and store teams can act on today.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/signin">
                  Sign in to the console <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/signin">Request a workspace</Link>
              </Button>
            </div>
            <p className="mt-6 text-[11px] text-muted-foreground">
              ISO 27001 aligned · Row-level tenant isolation · SAML / OIDC single sign-on
            </p>
          </motion.div>
        </section>

        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:grid-cols-4">
            {[
              ["5,000+", "conversations analysed per estate week"],
              ["6", "languages understood out of the box"],
              ["<2 min", "median time to alert the right owner"],
              ["100%", "actions captured in the audit trail"],
            ].map(([value, label]) => (
              <div key={label} className="text-center sm:text-left">
                <p className="text-2xl font-semibold tracking-tight text-primary">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            One platform, six connected modules
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Each module works on its own and gets sharper together — the same conversations power
            executive reporting, alerting and infrastructure health.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="panel p-6"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <item.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Why retail teams choose AegisIQ CX™
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {ADVANTAGES.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border border-border p-5">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-background text-primary ring-1 ring-border">
                    <item.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it simplifies the day-to-day
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((item) => (
              <div key={item.step} className="panel p-6">
                <p className="font-mono text-xs text-primary">{item.step}</p>
                <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {OUTCOMES.map((outcome) => (
              <p key={outcome} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                {outcome}
              </p>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-5 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to hear what your customers are actually saying?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              Sign in with your corporate account, Google Workspace or your company's SAML / OIDC
              identity provider.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/signin">
                Enter the console <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-[11px] text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} AegisIQ CX™. All rights reserved.</p>
          <p>Powered by AI Algo (S) Pte Ltd.</p>
          <p>Enterprise-grade security · Regional data residency ready</p>
        </div>
      </footer>
    </div>
  );
}
