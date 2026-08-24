"use client"

import * as React from "react"
import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheck className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        warning: <TriangleAlert className="h-5 w-5" />,
        error: <OctagonX className="h-5 w-5" />,
        loading: <LoaderCircle className="h-5 w-5 animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--color-surface-card)] group-[.toaster]:text-[var(--color-fg)] group-[.toaster]:border group-[.toaster]:border-[var(--color-border)] group-[.toaster]:rounded-[12px] group-[.toaster]:px-4 group-[.toaster]:py-3 group-[.toaster]:gap-3 group-[.toaster]:flex group-[.toaster]:items-start",
          title: "text-[14px] font-semibold leading-tight text-[var(--color-fg)]",
          description: "text-[13px] leading-relaxed text-[var(--color-fg-secondary)] mt-0.5",
          actionButton:
            "group-[.toast]:bg-[var(--color-primary)] group-[.toast]:text-white group-[.toast]:rounded-[10px] group-[.toast]:px-3 group-[.toast]:py-2 text-[13px] font-medium min-h-[44px] inline-flex items-center",
          cancelButton:
            "group-[.toast]:bg-[var(--color-surface-subtle)] group-[.toast]:text-[var(--color-fg)] group-[.toast]:rounded-[10px] group-[.toast]:px-3 group-[.toast]:py-2 text-[13px] font-medium min-h-[44px] inline-flex items-center",
          closeButton:
            "group-[.toast]:rounded-[10px] group-[.toast]:p-2 group-[.toast]:hover:bg-[var(--color-surface-subtle)] min-h-[44px] min-w-[44px] inline-flex items-center justify-center",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
