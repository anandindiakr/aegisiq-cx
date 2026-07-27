import { Link, useRouterState } from "@tanstack/react-router";
import { BrainCircuit, Languages, MessagesSquare, Search, Tags } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { label: "Conversations", to: "/conversationiq", icon: MessagesSquare },
  { label: "Search", to: "/conversationiq/search", icon: Search },
  { label: "AI Review", to: "/conversationiq/review", icon: BrainCircuit },
  { label: "Keywords", to: "/conversationiq/keywords", icon: Tags },
  { label: "Languages", to: "/conversationiq/languages", icon: Languages },
] as const;

/** Shared module sub-navigation so every ConversationIQ page stays oriented. */
export function ConversationIqTabs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface/50 p-1">
      {TABS.map((tab) => {
        const active = pathname === tab.to || pathname === `${tab.to}/`;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary/15 text-primary ring-1 ring-primary/25"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
