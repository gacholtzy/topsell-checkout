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

    return (
        <div className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => router.push('/order')} className="pl-0">
                    <ArrowLeftIcon className="h-4 w-4 mr-1" /> Kembali ke Pesanan
                </Button>
                <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Perbarui
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Package className="h-5 w-5" /> Lacak Paket
                    </CardTitle>
                    <p className="text-sm text-gray-500">Invoice {invoice}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-6 w-2/3" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    ) : error ? (
                        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    ) : tracking ? (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className={`${statusTone(tracking.biteshipStatus)} text-white`}>
                                    {tracking.biteshipLabel || 'Menunggu kurir'}
                                </Badge>
                                {!tracking.biteshipStatus && (
                                    <span className="text-sm text-gray-500">Pengiriman sedang disiapkan oleh gudang.</span>
                                )}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 text-sm">
                                <div className="rounded-md border p-3">
                                    <div className="flex items-center gap-2 text-gray-500 mb-1"><Truck className="h-4 w-4" /> Kurir</div>
                                    <div className="font-semibold">
                                        {[tracking.courierName, tracking.courierServiceName].filter(Boolean).join(' ') || '-'}
                                    </div>
                                </div>
                                <div className="rounded-md border p-3">
                                    <div className="flex items-center gap-2 text-gray-500 mb-1"><Package className="h-4 w-4" /> No. Resi</div>
                                    <div className="font-mono font-semibold break-all">{tracking.waybillId || 'Belum terbit'}</div>
                                </div>
                                {(tracking.driverName || tracking.driverPhone) && (
                                    <div className="rounded-md border p-3 sm:col-span-2">
                                        <div className="flex items-center gap-2 text-gray-500 mb-1"><User className="h-4 w-4" /> Driver</div>
                                        <div className="font-semibold">{tracking.driverName}{tracking.driverPlateNumber ? ` · ${tracking.driverPlateNumber}` : ''}</div>
                                        {tracking.driverPhone && (
                                            <a href={`tel:${tracking.driverPhone}`} className="inline-flex items-center gap-1 text-blue-600 mt-1">
                                                <Phone className="h-3.5 w-3.5" /> {tracking.driverPhone}
                                            </a>
                                        )}
                                    </div>
                                )}
                                {tracking.destinationAddress && (
                                    <div className="rounded-md border p-3 sm:col-span-2">
                                        <div className="flex items-center gap-2 text-gray-500 mb-1"><MapPin className="h-4 w-4" /> Tujuan</div>
                                        <div>{tracking.destinationAddress}</div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="font-semibold mb-3">Riwayat Perjalanan</h3>
                                {history.length === 0 ? (
                                    <p className="text-sm text-gray-500 flex items-center gap-2">
                                        <Clock className="h-4 w-4" /> Belum ada pembaruan dari kurir.
                                    </p>
                                ) : (
                                    <ol className="relative border-l border-gray-200 ml-2">
                                        {history.map((event, index) => (
                                            <li key={`${event.updatedAt}-${index}`} className="mb-5 ml-5">
                                                <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${index === 0 ? statusTone(event.status) : 'bg-gray-300'}`}>
                                                    {DONE_STATUSES.has(event.status) && <CheckCircle className="h-3 w-3 text-white" />}
                                                </span>
                                                <div className={`text-sm ${index === 0 ? 'font-semibold' : 'text-gray-700'}`}>{event.label || event.status}</div>
                                                {event.note && <div className="text-sm text-gray-600">{event.note}</div>}
                                                <div className="text-xs text-gray-400 mt-0.5">{formatDate(event.updatedAt)}</div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>

                            {tracking.link && (
                                <Button asChild variant="outline" size="sm">
                                    <a href={tracking.link} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4 mr-1" /> Lihat di situs kurir
                                    </a>
                                </Button>
                            )}
                        </>
                    ) : null}
                </CardContent>
            </Card>

            <div className="flex justify-center">
                <WhatsappCsButton />
            </div>
            <p className="text-center text-xs text-gray-400">
                <Link href="/order" className="underline">Semua pesanan</Link>
            </p>
        </div>
    )
}

export default TrackingPage
