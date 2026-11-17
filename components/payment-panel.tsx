"use client"

import React from 'react'
import Link from 'next/link'
import { RiArrowRightLine, RiTimeLine } from '@remixicon/react'
import { buttonStyles } from '@/components/base/buttons/button'
import { cx } from '@/utils/cx'
import type { Order } from '@/lib/order-utils'

import { formatCountdown, remainingSeconds } from '@/lib/payment-countdown'

/**
 * The "Bayar Sekarang" button and the time left to use it, for an unpaid order.
 *
 * Renders nothing when there is nothing to offer — an order with no payment page
 * (a Xendit method, say) and no known deadline — rather than an empty box.
 */
const PaymentPanel = ({ order, loadedAt }: { order: Order; loadedAt: number }) => {
    const secondsLeft = order.paymentSecondsLeft
    const hasDeadline = typeof secondsLeft === 'number'

    // Ticks only when there is a deadline to count towards.
    const [now, setNow] = React.useState(() => Date.now())
    React.useEffect(() => {
        if (!hasDeadline) return
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [hasDeadline])

    // Manual transfer is paid on our own page; every Snap method on Midtrans's.
    const isManual = order.paymentMethod?.key === 'manual'
    const payUrl = isManual ? `/manual?inv=${encodeURIComponent(order.invoice)}` : order.paymentUrl

    const remaining = hasDeadline ? remainingSeconds(secondsLeft, loadedAt, now) : null
    const expired = remaining === 0

    if (!payUrl && !hasDeadline) return null

    const payButtonClass = cx(
        buttonStyles.base,
        buttonStyles.size.medium,
        buttonStyles.variant.primary,
        'min-h-11 w-full shrink-0 sm:min-h-9 sm:w-auto'
    )

    return (
        <div
            className={cx(
                'flex flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
                expired ? 'bg-status-rose-background' : 'bg-status-yellow-background'
            )}
        >
            <div className="min-w-0">
                {hasDeadline && !expired && (
                    <div className="flex flex-wrap items-center gap-1.5 text-status-yellow-text">
                        <RiTimeLine className="size-4 shrink-0" aria-hidden />
                        <span className="text-body-regular">Selesaikan dalam</span>
                        <span className="text-body-medium font-semibold tabular-nums" dir="ltr">
                            {formatCountdown(remaining!)}
                        </span>
                    </div>
                )}

                {expired && (
                    <p className="text-body-medium text-status-rose-text">
                        Waktu pembayaran habis. Pesanan ini akan segera kedaluwarsa, silakan buat pesanan baru.
                    </p>
                )}

                {!hasDeadline && payUrl && (
                    <p className="text-body-regular text-status-yellow-text">
                        Menunggu pembayaran diselesaikan.
                    </p>
                )}
            </div>

            {/* Gone once the time is up: the Snap page behind it would only say expired. */}
            {payUrl && !expired && (
                isManual ? (
                    <Link href={payUrl} className={payButtonClass}>
                        <span className={buttonStyles.label.medium}>Bayar sekarang</span>
                        <RiArrowRightLine className={buttonStyles.icon.medium} aria-hidden />
                    </Link>
                ) : (
                    <a href={payUrl} className={payButtonClass}>
                        <span className={buttonStyles.label.medium}>Bayar sekarang</span>
                        <RiArrowRightLine className={buttonStyles.icon.medium} aria-hidden />
                    </a>
                )
            )}
        </div>
    )
}

export default PaymentPanel
