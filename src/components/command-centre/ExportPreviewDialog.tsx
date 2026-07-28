import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { REPORT_SECTIONS } from "@/features/command-centre/reportTemplates";

const SECTION_LABELS = new Map(REPORT_SECTIONS.map((s) => [s.id, s]));

export interface ExportPreview {
  /** What is about to happen: a manual export or a scheduled delivery. */
  kind: "export" | "delivery";
  format: string;
  templateName: string;
  templateVersion: number | null;
  sections: string[];
  recipients?: string[];
  rangeLabel?: string;
  filterSummary?: string;
}

/**
 * Confirmation step shown before anything is generated: the exact sections that
 * will render, in order, and the template version they come from — so nobody
 * discovers a missing chapter after the board pack has gone out.
 */
export function ExportPreviewDialog({
  preview,
  onOpenChange,
  onConfirm,
  busy,
}: {
  preview: ExportPreview | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const sections = preview?.sections ?? [];

  return (
    <Dialog open={preview !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {preview?.kind === "delivery" ? "Preview delivery" : "Preview export"}
          </DialogTitle>
          <DialogDescription>
            Review exactly what will render before{" "}
            {preview?.kind === "delivery" ? "sending this report" : "generating this output"}.
          </DialogDescription>
        </DialogHeader>

        {preview && (
          <div className="space-y-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {preview.format}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {preview.templateName}
                {preview.templateVersion ? ` · v${preview.templateVersion}` : ""}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {sections.length} section{sections.length === 1 ? "" : "s"}
              </Badge>
              {preview.rangeLabel && (
                <Badge variant="outline" className="text-[10px]">
                  {preview.rangeLabel}
                </Badge>
              )}
            </div>

            {preview.filterSummary && (
              <p className="text-[11px] text-muted-foreground">{preview.filterSummary}</p>
            )}

            {preview.recipients && preview.recipients.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Recipients: {preview.recipients.join(", ")}
              </p>
            )}

            <ScrollArea className="max-h-64 rounded-lg border border-border/70">
              <ol className="divide-y divide-border/60">
                {sections.length === 0 && (
                  <li className="p-4 text-center text-xs text-muted-foreground">
                    This template has no sections selected — the output will be empty.
                  </li>
                )}
                {sections.map((id, index) => {
                  const section = SECTION_LABELS.get(id);
                  return (
                    <li key={id} className="flex items-start gap-3 p-2.5">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-medium tabular-nums text-primary">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">
                          {section?.label ?? id}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {section?.description ?? "Custom section"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy || sections.length === 0}>
            {preview?.kind === "delivery" ? "Send now" : "Generate export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
