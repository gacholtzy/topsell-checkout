import React from "react"
import { RiCheckLine } from "@remixicon/react"
import { cx } from "@/utils/cx"

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
    <section className={cx("px-4 py-5 sm:px-6 sm:py-6", className)} aria-labelledby={`step-${step}`}>
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cx(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-caption-1-semibold tabular-nums",
            done
              ? "bg-status-lime-background text-status-lime-text"
              : "bg-text-primary text-text-white"
          )}
        >
          {done ? <RiCheckLine className="size-4" /> : step}
        </span>
        <h2 id={`step-${step}`} className="text-headline-semibold text-text-primary">
          {title}
          {done && <span className="sr-only"> (selesai)</span>}
        </h2>
        {hint && !done && <span className="ms-auto text-body-regular text-text-secondary">{hint}</span>}
      </div>
      {children}
    </section>
  )
}
