import { Check, Minus } from "lucide-react";

import { Panel } from "@/components/common/Primitives";
import { CAPABILITY_LABELS, useIqAccess, type IqCapability } from "@/features/conversationiq/access";

const ORDER: IqCapability[] = [
  "viewTranscripts",
  "editNotesTags",
  "editAnchors",
  "moveQueue",
  "assignQueue",
  "reviewAlerts",
  "exportCompliance",
  "viewAudit",
];

/** What the signed-in reviewer's roles allow inside ConversationIQ™. */
export function IqAccessPanel() {
  const access = useIqAccess();

  return (
    <Panel
      title="ConversationIQ™ access"
      description="Capabilities granted by your roles. The database enforces the same rules."
    >
      {access.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading permissions…</p>
      ) : (
        <ul className="space-y-2">
          {ORDER.map((capability) => {
            const allowed = access.can(capability);
            return (
              <li key={capability} className="flex items-center gap-2 text-sm">
                {allowed ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : (
                  <Minus className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={allowed ? "" : "text-muted-foreground"}>
                  {CAPABILITY_LABELS[capability]}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
