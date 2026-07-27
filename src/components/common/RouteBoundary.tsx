import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertTriangle, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MetricSkeletonGrid, LoadingState } from "@/components/common/Primitives";
import { reportLovableError } from "@/lib/lovable-error-reporting";

function messageOf(error: unknown) {
  if (error instanceof Response) return `Request failed with status ${error.status}.`;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

/** Shared route-level error boundary UI (wired as the router default). */
export function RouteErrorBoundary({ error, reset }: { error: Error; reset?: () => void }) {
  useEffect(() => {
    reportLovableError(error, { boundary: "route_error_boundary" });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/15 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold">This section didn't load</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{messageOf(error)}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={() => (reset ? reset() : window.location.reload())}>
          Try again
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}

/** Shared route-level pending UI (wired as the router default). */
export function RoutePending() {
  return (
    <div className="space-y-6 p-1" aria-busy="true" aria-live="polite">
      <MetricSkeletonGrid count={3} />
      <LoadingState rows={6} />
    </div>
  );
}

/** Shared route-level not-found UI (wired as the router default). */
export function RouteNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted/60 text-muted-foreground">
        <SearchX className="size-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold">We couldn't find that page</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The page you're looking for doesn't exist or you no longer have access to it.
      </p>
      <Button asChild size="sm" className="mt-5">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}
