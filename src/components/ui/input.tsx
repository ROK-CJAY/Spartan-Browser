import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--addr)] px-3 text-sm text-[var(--fg)] placeholder:text-[var(--muted)] outline-none focus:ring-2 focus:ring-[var(--accent)]",
        className,
      )}
      suppressHydrationWarning
      {...props}
    />
  );
}
