import React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One step of the checkout. The step number is real information here (the
 * order matters: what you can pick next depends on what you picked before),
 * and it turns into a check once the step is complete so the customer can see
 * what is still open without scrolling back.
 */
export function CheckoutSection({
  step,
  title,
  done = false,
  hint,
  children,
  className,
}: {
  step: number
  title: string
  done?: boolean
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("px-4 py-5 sm:px-6 sm:py-6", className)} aria-labelledby={`step-${step}`}>
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
            done ? "bg-success text-white" : "bg-foreground text-background"
          )}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : step}
        </span>
        <h2 id={`step-${step}`} className="text-base font-bold leading-tight sm:text-lg">
          {title}
          {done && <span className="sr-only"> (selesai)</span>}
        </h2>
        {hint && !done && <span className="ml-auto text-sm text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  )
}
