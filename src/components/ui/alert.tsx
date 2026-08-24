import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-[12px] border p-4 px-5 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-5 [&>svg]:top-4 [&>svg]:text-[var(--color-fg)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-primary-border)] bg-[var(--color-primary-tint)] text-[var(--color-primary-text)] [&>svg]:text-[var(--color-primary-text)]",
        destructive:
          "border-[var(--color-danger-border)] bg-[var(--color-danger-tint)] text-[var(--color-danger-text)] [&>svg]:text-[var(--color-danger-text)]",
        success:
          "border-[var(--color-success-border)] bg-[var(--color-success-tint)] text-[var(--color-success-text)] [&>svg]:text-[var(--color-success-text)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-[14px] font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[13px] leading-relaxed [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
