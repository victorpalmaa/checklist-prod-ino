import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[14px] font-medium transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-h-[44px] min-w-[44px] px-4 py-2",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]",
        destructive:
          "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-border)] hover:text-[var(--color-danger-text)]",
        outline:
          "border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]",
        secondary:
          "bg-[var(--color-surface-subtle)] text-[var(--color-fg)] hover:bg-[var(--color-primary-tint)]",
        ghost:
          "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]",
        link:
          "bg-transparent text-[var(--color-primary-text)] hover:underline underline-offset-4 px-0",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-[44px] rounded-[10px] px-3",
        lg: "h-12 rounded-[12px] px-6",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
