"use client"

import React from 'react'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { Button } from './ui/button'
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

    return (
        <div className="rounded-lg bg-warning-soft px-4 py-3 text-sm">
            {hasDeadline && !expired && (
                <div className="flex flex-wrap items-center gap-2 text-warning">
                    <Clock className="h-4 w-4" />
                    <span>Selesaikan pembayaran dalam</span>
                    <span className="text-lg font-extrabold tabular-nums">{formatCountdown(remaining!)}</span>
                </div>
            )}

            {expired && (
                <p className="font-medium text-destructive">
                    Waktu pembayaran habis. Pesanan ini akan segera kedaluwarsa, silakan buat pesanan baru.
                </p>
            )}

            {/* Gone once the time is up: the Snap page behind it would only say expired. */}
            {payUrl && !expired && (
                <Button asChild className="mt-3 w-full font-bold sm:w-auto">
                    {isManual ? (
                        <Link href={payUrl}>Bayar sekarang</Link>
                    ) : (
                        <a href={payUrl}>Bayar sekarang</a>
                    )}
                </Button>
            )}
        </div>
    )
}

export default PaymentPanel
