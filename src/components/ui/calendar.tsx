"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 text-[var(--color-fg)]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 sm:gap-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-[14px] font-semibold text-[var(--color-fg)]",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "h-9 w-9 bg-transparent p-0 opacity-80 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex gap-1",
        head_cell:
          "text-[var(--color-fg-muted)] rounded-[6px] w-10 font-medium text-[12px] text-center py-2",
        row: "flex w-full mt-1 gap-1",
        cell: "h-10 w-10 text-center text-[14px] p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-[10px] [&:has([aria-selected].day-outside)]:bg-[var(--color-primary-tint)]/60 [&:has([aria-selected])]:bg-[var(--color-primary-tint)] first:[&:has([aria-selected])]:rounded-l-[10px] last:[&:has([aria-selected])]:rounded-r-[10px] focus-within:relative focus-within:z-20 rounded-[6px]",
        day: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-[6px]"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)] hover:text-white focus:bg-[var(--color-primary)] focus:text-white",
        day_today:
          "bg-[var(--color-primary-tint)] text-[var(--color-primary-text)] font-semibold",
        day_outside:
          "day-outside text-[var(--color-fg-muted)] aria-selected:bg-[var(--color-primary-tint)]/50 aria-selected:text-[var(--color-fg-muted)]",
        day_disabled: "text-[var(--color-fg-muted)] opacity-50",
        day_range_middle:
          "aria-selected:bg-[var(--color-primary-tint)] aria-selected:text-[var(--color-primary-text)]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...rest }) => (
          <ChevronLeft className={cn("h-5 w-5", className)} {...rest} />
        ),
        IconRight: ({ className, ...rest }) => (
          <ChevronRight className={cn("h-5 w-5", className)} {...rest} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
