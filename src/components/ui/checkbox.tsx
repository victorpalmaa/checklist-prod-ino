"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <span className="-mx-3 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center">
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer h-[20px] w-[20px] shrink-0 rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--color-primary)] data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:text-white inline-flex items-center justify-center",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-current")}
      >
        <Check className="h-4 w-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  </span>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
