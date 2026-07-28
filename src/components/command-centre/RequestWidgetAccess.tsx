import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestWidgetAccess } from "@/features/command-centre/accessRequests";
import { WIDGETS } from "@/features/command-centre/widgets";

const LABELS = new Map(WIDGETS.map((w) => [w.id, w.label]));

/**
 * Lets a blocked viewer ask an admin for permission to see a restricted widget
 * instead of hitting a dead end on a deep link or a hidden dashboard tile.
 */
export function RequestWidgetAccess({
  widgetId,
  context,
  variant = "outline",
  size = "sm",
  className,
  label = "Request access",
}: {
  widgetId: string;
  context?: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default";
  className?: string;
  label?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: () => requestWidgetAccess({ widgetId, reason: reason.trim(), context }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["widget-access-requests"] });
      setOpen(false);
      setReason("");
      toast.success("Access requested", {
        description: "A workspace admin will review your request.",
      });
    },
    onError: (error: Error) =>
      toast.error("Could not send the request", { description: error.message }),
  });

  const widgetLabel = LABELS.get(widgetId) ?? widgetId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <KeyRound className="mr-2 size-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request access to “{widgetLabel}”</DialogTitle>
          <DialogDescription>
            Your roles do not currently include this Command Centre widget. Tell an admin why you
            need it and they can grant it from the access request queue.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label className="text-xs">Business justification</Label>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="I review outlet complaint escalations weekly and need the outlet league table."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!reason.trim() || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
