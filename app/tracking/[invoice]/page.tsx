"use client"

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, CheckCircle, Clock, ExternalLink, MapPin, Package, Phone, RefreshCw, Truck, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/useAuthStore'
import { useToast } from '@/hooks/use-toast'
import WhatsappCsButton from '@/components/whatsapp-cs-button'

/** GET /backend/orders/tracking: our order summary plus Biteship's live history. */
interface TrackingEvent {
    status: string
    label: string
    note: string
    updatedAt: string
}

interface OrderTracking {
    invoice: string
    orderStatus: string
    courierCompany: string
    courierName: string
    courierServiceName: string
    waybillId: string
    biteshipStatus: string
    biteshipLabel: string
    link: string
    driverName?: string
    driverPhone?: string
    driverPlateNumber?: string
    originAddress?: string
    destinationAddress?: string
    history: TrackingEvent[]
}

const DONE_STATUSES = new Set(['delivered'])
const PROBLEM_STATUSES = new Set(['rejected', 'courierNotFound', 'returned', 'returnInTransit', 'cancelled', 'disposed', 'onHold'])

const statusTone = (status: string) => {
    if (DONE_STATUSES.has(status)) return 'bg-green-500'
    if (PROBLEM_STATUSES.has(status)) return 'bg-red-500'
    if (!status) return 'bg-gray-400'
    return 'bg-blue-500'
}

const formatDate = (raw: string) => {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TrackingPage = () => {
    const params = useParams<{ invoice: string }>()
    const invoice = decodeURIComponent(params?.invoice || '')
    const router = useRouter()
    const { token } = useAuthStore()
    const { toast } = useToast()
    const [tracking, setTracking] = useState<OrderTracking | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')

    const load = React.useCallback(async (silent = false) => {
        if (!token) {
            setError('Silakan login untuk melihat pelacakan pesanan Anda.')
            setLoading(false)
            return
        }
        if (!silent) setLoading(true)
        try {
            const res = await fetch(`/backend/orders/tracking?invoice=${encodeURIComponent(invoice)}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data?.message || 'Gagal memuat pelacakan')
            }
            setTracking(data.data)
            setError('')
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Gagal memuat pelacakan'
            setError(message)
            if (silent) toast({ title: 'Gagal memperbarui', description: message, variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [invoice, token, toast])

    useEffect(() => {
        if (invoice) load()
    }, [invoice, load])

    // Newest first: the customer wants to know where the parcel is now.
    const history = React.useMemo(() => {
        const items = [...(tracking?.history || [])]
        items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        return items
    }, [tracking])

    const tone = tracking?.biteshipStatus ? (DONE_STATUSES.has(tracking.biteshipStatus) ? 'success' : PROBLEM_STATUSES.has(tracking.biteshipStatus) ? 'problem' : 'active') : 'idle'
    const toneClass = {
        success: 'bg-success-soft text-success',
        problem: 'bg-accent text-destructive',
        active: 'bg-secondary text-foreground',
        idle: 'bg-secondary text-muted-foreground',
    }[tone]

    return (
        <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
            <div className="mb-5 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.push('/order')} className="-ml-3">
                    <ArrowLeftIcon /> Pesanan
                </Button>
                <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
                    <RefreshCw className={loading ? 'animate-spin' : ''} /> Perbarui
                </Button>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Lacak paket</h1>
            <p className="mt-1 text-sm text-muted-foreground">Invoice {invoice}</p>

            {loading ? (
                <div className="mt-6 space-y-3" role="status" aria-label="Memuat pelacakan">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : error ? (
                <p className="mt-6 rounded-lg border border-destructive/40 bg-accent p-4 text-sm font-medium text-destructive" role="alert">
                    {error}
                </p>
            ) : tracking ? (
                <>
                    <div className={`mt-6 rounded-lg px-4 py-4 sm:px-5 ${toneClass}`}>
                        <p className="text-lg font-bold">{tracking.biteshipLabel || 'Menunggu kurir'}</p>
                        {!tracking.biteshipStatus && (
                            <p className="mt-0.5 text-sm">Pesanan sedang disiapkan gudang. Resi muncul setelah kurir menjemput.</p>
                        )}
                    </div>

                    <dl className="mt-6 divide-y rounded-3xl border border-border-button-default bg-background-full text-sm">
                        <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                            <dt className="text-muted-foreground">Kurir</dt>
                            <dd className="font-semibold">{[tracking.courierName, tracking.courierServiceName].filter(Boolean).join(' ') || '-'}</dd>
                        </div>
                        <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                            <dt className="text-muted-foreground">No. resi</dt>
                            <dd className="break-all font-semibold tabular-nums">{tracking.waybillId || 'Belum terbit'}</dd>
                        </div>
                        {(tracking.driverName || tracking.driverPhone) && (
                            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                                <dt className="text-muted-foreground">Driver</dt>
                                <dd>
                                    <span className="font-semibold">{tracking.driverName}{tracking.driverPlateNumber ? ` · ${tracking.driverPlateNumber}` : ''}</span>
                                    {tracking.driverPhone && (
                                        <a href={`tel:${tracking.driverPhone}`} className="mt-1 flex items-center gap-1.5 font-medium text-primary underline underline-offset-4">
                                            <Phone className="h-4 w-4" /> {tracking.driverPhone}
                                        </a>
                                    )}
                                </dd>
                            </div>
                        )}
                        {tracking.destinationAddress && (
                            <div className="grid gap-1 p-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                                <dt className="text-muted-foreground">Tujuan</dt>
                                <dd>{tracking.destinationAddress}</dd>
                            </div>
                        )}
                    </dl>

                    <h2 className="mb-3 mt-8 text-lg font-bold">Riwayat perjalanan</h2>
                    {history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada pembaruan dari kurir.</p>
                    ) : (
                        <ol className="relative ml-2 border-l">
                            {history.map((event, index) => (
                                <li key={`${event.updatedAt}-${index}`} className="mb-6 ml-6 last:mb-0">
                                    <span className={`absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-background ${index === 0 ? (DONE_STATUSES.has(event.status) ? 'bg-success' : PROBLEM_STATUSES.has(event.status) ? 'bg-destructive' : 'bg-primary') : 'bg-input'}`} aria-hidden="true" />
                                    <p className={`text-sm ${index === 0 ? 'font-bold' : 'font-medium'}`}>{event.label || event.status}</p>
                                    {event.note && <p className="text-sm text-muted-foreground">{event.note}</p>}
                                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatDate(event.updatedAt)}</p>
                                </li>
                            ))}
                        </ol>
                    )}

                    {tracking.link && (
                        <Button asChild variant="outline" className="mt-6">
                            <a href={tracking.link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink /> Buka di situs kurir
                            </a>
                        </Button>
                    )}
                </>
            ) : null}

            <WhatsappCsButton />
        </div>
    )
}

export default TrackingPage
