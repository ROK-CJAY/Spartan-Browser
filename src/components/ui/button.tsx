import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-[opacity,transform,background-color] duration-[var(--motion-quick)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90",
        ghost:
          "bg-transparent text-[var(--fg)] hover:bg-[var(--btn)]",
        rail: "bg-[var(--btn)] text-[var(--fg)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]",
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--fg)] hover:bg-[var(--btn)]",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-8 px-2.5 text-xs",
        icon: "size-11",
        rail: "size-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
