import React from "react"
import { RiBankLine, RiBankCardLine } from "@remixicon/react"
import { cx } from "@/utils/cx"

/**
 * Logo for a payment method.
 *
 * The backend sends an `icon` URL per method; when it is missing or is only the
 * placeholder picture, the logo is picked from the method's `key` instead.
 * Transfer manual and pay-at-store have no brand, so they get a plain icon.
 * Anything else falls back to its initials.
 */
const LOGOS: Record<string, string> = {
  bca: "/images/payments/bca.svg",
  bni: "/images/payments/bni.svg",
  mandiri: "/images/payments/mandiri.svg",
  bri: "/images/payments/bri.svg",
  permata: "/images/payments/permata.svg",
  qris: "/images/payments/qris.svg",
}

type Method = { key?: string; name?: string; icon?: string }

export function paymentLogo(method: Method): string | null {
  const key = (method.key || "").toLowerCase()
  if (method.icon && !method.icon.includes("placeholder")) return method.icon
  return LOGOS[key] ?? null
}

export function PaymentMark({ method, className }: { method: Method; className?: string }) {
  const key = (method.key || "").toLowerCase()
  const src = paymentLogo(method)
  const Icon = key === "manual" ? RiBankLine : key === "cc" ? RiBankCardLine : null
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-border-button-default bg-background-full p-1.5",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
      ) : Icon ? (
        <Icon className="size-5 text-foreground-icon-secondary" />
      ) : (
        <span className="text-caption-1-semibold text-text-secondary">
          {(method.name || "?").slice(0, 3).toUpperCase()}
        </span>
      )}
    </span>
  )
}
