import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[6px] border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-primary)] text-white",
        secondary:
          "border-transparent bg-[var(--color-surface-subtle)] text-[var(--color-fg)]",
        destructive:
          "border border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] text-[var(--color-danger-text)]",
        success:
          "border border-[var(--color-success-border)] bg-[var(--color-success-tint)] text-[var(--color-success-text)]",
        outline: "border border-[var(--color-border-strong)] text-[var(--color-fg)]",
        purple:
          "border border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
