import { cn } from "@/lib/utils";

/**
 * Shared brand footer used across authenticated, public and error surfaces so
 * the attribution line stays identical everywhere.
 */
export function BrandFooter({
  className,
  variant = "static",
}: {
  className?: string;
  variant?: "static" | "overlay";
}) {
  return (
    <footer
      className={cn(
        "w-full text-[11px] text-muted-foreground",
        variant === "overlay" && "absolute inset-x-0 bottom-0 z-10 px-5 pb-4",
        variant === "static" && "border-t border-border py-4",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 sm:flex-row md:px-8">
        <p>© {new Date().getFullYear()} AegisIQ CX™. All rights reserved.</p>
        <p>Powered by AI Algo (S) Pte Ltd.</p>
      </div>
    </footer>
  );
}
