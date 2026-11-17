"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
    RiArrowRightLine,
    RiBankCardLine,
    RiBox3Line,
    RiCheckLine,
    RiCheckboxCircleLine,
    RiCloseCircleLine,
    RiCoupon3Line,
    RiCustomerService2Line,
    RiExternalLinkLine,
    RiFileCopyLine,
    RiLoginBoxLine,
    RiMapPinLine,
    RiRefreshLine,
    RiShoppingBag3Line,
    RiTimeLine,
    RiTruckLine,
} from '@remixicon/react'
import { Breadcrumb, BreadcrumbItem } from '@/components/base/breadcrumb/breadcrumb'
import { Chip, type ChipColor } from '@/components/base/badges/chip'
import { Button, ButtonLink, buttonStyles } from '@/components/base/buttons/button'
import { Divider } from '@/components/base/divider/divider'
import { SearchField } from '@/components/base/search-field/search-field'
import { Skeleton } from '@/components/base/skeleton/skeleton'
import { Tab, TabList, TabPanel, Tabs } from '@/components/base/tabs/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaginationComponent } from '@/components/PaginationComponent'
import { PaymentMark } from '@/components/payment-mark'
import PaymentPanel from '@/components/payment-panel'
import WhatsappCsButton, { CS_WHATSAPP_URL } from '@/components/whatsapp-cs-button'
import { useToast } from '@/hooks/use-toast'
import { getOrderHistory, type Order } from '@/lib/order-utils'
import { useAuthStore } from '@/lib/useAuthStore'
import { cx } from '@/utils/cx'

type OrderStatusKey = 'pending' | 'proses' | 'sent' | 'complete' | 'expired'

interface StatusBucket {
    orders: Order[]
    page: number
    total: number
    totalPages: number
    loading: boolean
    error: string
}

const INITIAL_BUCKET: StatusBucket = {
    orders: [],
    page: 1,
    total: 0,
    totalPages: 0,
    loading: true,
    error: '',
}

const STATUS_TABS: {
    key: OrderStatusKey
    label: string
    icon: typeof RiTimeLine
    emptyTitle: string
    emptyDescription: string
}[] = [
    {
        key: 'pending',
        label: 'Belum Bayar',
        icon: RiTimeLine,
        emptyTitle: 'Belum ada tagihan',
        emptyDescription: 'Pesanan yang menunggu pembayaran akan muncul di sini.',
    },
    {
        key: 'proses',
        label: 'Diproses',
        icon: RiBox3Line,
        emptyTitle: 'Tidak ada pesanan diproses',
        emptyDescription: 'Pesanan yang sedang disiapkan toko akan tampil di sini.',
    },
    {
        key: 'sent',
        label: 'Dikirim',
        icon: RiTruckLine,
        emptyTitle: 'Belum ada pesanan dikirim',
        emptyDescription: 'Pesanan dalam perjalanan atau siap diambil di toko akan muncul di sini.',
    },
    {
        key: 'complete',
        label: 'Selesai',
        icon: RiCheckboxCircleLine,
        emptyTitle: 'Belum ada pesanan selesai',
        emptyDescription: 'Riwayat pesanan yang sudah selesai akan tersimpan di sini.',
    },
    {
        key: 'expired',
        label: 'Kadaluarsa',
        icon: RiCloseCircleLine,
        emptyTitle: 'Tidak ada pesanan kadaluarsa',
        emptyDescription: 'Pesanan yang melewati batas waktu bayar akan muncul di sini.',
    },
]

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(amount)

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

const getStatusMeta = (status: string, shippingTitle?: string): { label: string; color: ChipColor } => {
    const isPickup = shippingTitle === 'Ambil di Toko'
    switch (status) {
        case 'pending':
            return { label: 'Belum Bayar', color: 'yellow' }
        case 'proses':
            return { label: 'Diproses', color: 'blue' }
        case 'sent':
            return { label: isPickup ? 'Ambil di Toko' : 'Dikirim', color: 'cyan' }
        case 'complete':
            return { label: 'Selesai', color: 'lime' }
        case 'expired':
            return { label: 'Kadaluarsa', color: 'neutral' }
        default:
            return { label: status.toUpperCase(), color: 'neutral' }
    }
}

const OrderCardSkeleton = () => (
    <div className="rounded-3xl border border-border-button-default bg-background-full p-4 sm:p-6" aria-busy="true">
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
                <Skeleton shape="text" className="h-5 w-40" />
                <Skeleton shape="text" className="h-4 w-28" />
            </div>
            <Skeleton shape="rect" className="h-7 w-24" />
        </div>
        <div className="mt-4 space-y-3 border-t border-separator-border pt-4">
            <div className="flex items-center gap-3">
                <Skeleton shape="rect" className="size-12 shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton shape="text" className="h-4 w-3/4" />
                    <Skeleton shape="text" className="h-4 w-1/3" />
                </div>
            </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-separator-border pt-4">
            <div className="space-y-1.5">
                <Skeleton shape="text" className="h-3.5 w-24" />
                <Skeleton shape="text" className="h-5 w-32" />
            </div>
            <Skeleton shape="rect" className="h-9 w-28" />
        </div>
    </div>
)

const OrderPage = () => {
    const { toast } = useToast()
    const { token } = useAuthStore()

    const [activeTab, setActiveTab] = useState<OrderStatusKey>('pending')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [copiedValue, setCopiedValue] = useState<string | null>(null)
    // When the unpaid list arrived. Each order reports its time left as of THAT
    // moment, so the countdown needs it to keep counting down from there.
    const [pendingLoadedAt, setPendingLoadedAt] = useState<number>(() => Date.now())

    const [buckets, setBuckets] = useState<Record<OrderStatusKey, StatusBucket>>({
        pending: INITIAL_BUCKET,
        proses: INITIAL_BUCKET,
        sent: INITIAL_BUCKET,
        complete: INITIAL_BUCKET,
        expired: INITIAL_BUCKET,
    })

    const fetchBucket = useCallback(
        async (status: OrderStatusKey, page: number) => {
            if (!token) {
                setBuckets((prev) => ({
                    ...prev,
                    [status]: { ...prev[status], loading: false, error: '' },
                }))
                return
            }

            setBuckets((prev) => ({
                ...prev,
                [status]: { ...prev[status], loading: true, error: '' },
            }))

            try {
                const results = await getOrderHistory(token, status, page, 5)
                if (results.status !== 200) {
                    throw new Error(results.message || 'Gagal mengambil riwayat pesanan')
                }

                if (status === 'pending') {
                    setPendingLoadedAt(Date.now())
                }

                setBuckets((prev) => ({
                    ...prev,
                    [status]: {
                        orders: results.data || [],
                        page,
                        total: results.total ?? 0,
                        totalPages: results.totalPage ?? 0,
                        loading: false,
                        error: '',
                    },
                }))
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Gagal mengambil pesanan'
                setBuckets((prev) => ({
                    ...prev,
                    [status]: { ...prev[status], loading: false, error: message },
                }))
            }
        },
        [token]
    )

    useEffect(() => {
        STATUS_TABS.forEach(({ key }) => {
            fetchBucket(key, 1)
        })
    }, [fetchBucket])

    const handlePageChange = (status: OrderStatusKey, nextPage: number) => {
        setBuckets((prev) => ({
            ...prev,
            [status]: { ...prev[status], page: nextPage },
        }))
        fetchBucket(status, nextPage)
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    const handleCopy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedValue(value)
            toast({ title: `${label} disalin` })
            setTimeout(() => {
                setCopiedValue((prev) => (prev === value ? null : prev))
            }, 2000)
        } catch {
            toast({
                title: 'Gagal menyalin',
                description: `Salin ${label.toLowerCase()} secara manual.`,
                variant: 'destructive',
            })
        }
    }

    const normalizedQuery = searchQuery.trim().toLowerCase()

    const filteredBuckets = useMemo(() => {
        if (!normalizedQuery) return buckets
        const next = { ...buckets }
        ;(Object.keys(next) as OrderStatusKey[]).forEach((key) => {
            next[key] = {
                ...next[key],
                orders: next[key].orders.filter(
                    (order) =>
                        order.invoice.toLowerCase().includes(normalizedQuery) ||
                        order.products.some((item) => item.name.toLowerCase().includes(normalizedQuery))
                ),
            }
        })
        return next
    }, [buckets, normalizedQuery])

    const OrderCard = ({ order }: { order: Order }) => {
        const isPickup = order.shipping?.title === 'Ambil di Toko'
        const statusMeta = getStatusMeta(order.status, order.shipping?.title)
        const visibleProducts = order.products.slice(0, 2)
        const hiddenCount = Math.max(0, order.products.length - visibleProducts.length)
        const totalQty = order.products.reduce((sum, item) => sum + item.qty, 0)

        const hasTrackingPage =
            !isPickup &&
            (Boolean(order.trackingUrl) || (!order.trackingNumber && Boolean(order.biteshipTrackingID)))
        const trackingHref =
            !order.trackingNumber && order.biteshipTrackingID
                ? `/tracking/${order.invoice}`
                : order.trackingUrl || ''
        const isInternalTracking = trackingHref.startsWith('/')

        return (
            <article className="overflow-hidden rounded-3xl border border-border-button-default bg-background-full transition-colors hover:border-border-button-hover">
                {/* Card Header: Invoice, Date, Status */}
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-separator-border px-4 py-3.5 sm:px-6">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="break-all text-body-medium font-semibold tabular-nums text-text-primary" dir="ltr">
                                {order.invoice}
                            </h3>
                            <button
                                type="button"
                                onClick={() => handleCopy(order.invoice, 'Nomor invoice')}
                                className="inline-flex size-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-background-secondary-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                                aria-label={`Salin nomor invoice ${order.invoice}`}
                                title="Salin invoice"
                            >
                                {copiedValue === order.invoice ? (
                                    <RiCheckLine className="size-3.5 text-status-lime-text" aria-hidden />
                                ) : (
                                    <RiFileCopyLine className="size-3.5" aria-hidden />
                                )}
                            </button>
                        </div>
                        <p className="mt-0.5 text-caption-1-regular text-text-secondary">
                            {formatDate(order.createdAt)}
                        </p>
                    </div>
                    <Chip variant="bold" color={statusMeta.color}>
                        {statusMeta.label}
                    </Chip>
                </header>

                {/* Card Body: Compact Product Preview + Priority Action Strip */}
                <div className="space-y-4 p-4 sm:px-6 sm:py-5">
                    <ul className="space-y-3">
                        {visibleProducts.map((item, index) => (
                            <li key={`${item.id}-${index}`} className="flex items-start gap-3">
                                <img
                                    src={item.images[0]?.src}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                    width={48}
                                    height={48}
                                    className="size-12 shrink-0 rounded-xl border border-separator-border bg-background-secondary-default object-contain"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-body-medium text-text-primary">{item.name}</p>
                                    <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 text-caption-1-regular text-text-secondary">
                                        <span>{item.qty} barang</span>
                                        <span className="font-medium tabular-nums text-text-primary">
                                            {formatCurrency(Number(item.price) * item.qty)}
                                        </span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {hiddenCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="text-caption-1-medium text-accent-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                        >
                            +{hiddenCount} produk lainnya (lihat detail)
                        </button>
                    )}

                    {/* Priority Action 1: Unpaid order payment countdown & Pay CTA */}
                    {order.status === 'pending' && <PaymentPanel order={order} loadedAt={pendingLoadedAt} />}

                    {/* Priority Action 2: Shipment / Tracking strip */}
                    {!isPickup && (order.trackingNumber || order.biteshipTrackingID) && (
                        <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 space-y-0.5">
                                {order.biteshipStatusLabel && (
                                    <p className="text-body-medium text-text-primary">{order.biteshipStatusLabel}</p>
                                )}
                                {order.trackingNumber ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-caption-1-regular text-text-secondary">
                                            Resi{order.courierName ? ` · ${order.courierName}` : ''}:
                                        </span>
                                        <span className="break-all text-body-medium font-semibold tabular-nums text-text-primary" dir="ltr">
                                            {order.trackingNumber}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(order.trackingNumber!, 'Nomor resi')}
                                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption-1-medium text-text-secondary transition-colors hover:bg-background-tertiary-default hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                                        >
                                            {copiedValue === order.trackingNumber ? (
                                                <>
                                                    <RiCheckLine className="size-3.5 text-status-lime-text" aria-hidden />
                                                    Disalin
                                                </>
                                            ) : (
                                                <>
                                                    <RiFileCopyLine className="size-3.5" aria-hidden />
                                                    Salin
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-caption-1-regular text-text-secondary">
                                        Kurir sedang disiapkan. Nomor resi menyusul.
                                    </p>
                                )}
                            </div>

                            {hasTrackingPage && trackingHref && (
                                isInternalTracking ? (
                                    <Link
                                        href={trackingHref}
                                        className={cx(
                                            buttonStyles.base,
                                            buttonStyles.size.small,
                                            order.status === 'sent'
                                                ? buttonStyles.variant.primary
                                                : buttonStyles.variant.secondary,
                                            'min-h-10 shrink-0 sm:min-h-8'
                                        )}
                                    >
                                        <RiTruckLine className={buttonStyles.icon.small} aria-hidden />
                                        <span className={buttonStyles.label.small}>Lacak paket</span>
                                    </Link>
                                ) : (
                                    <ButtonLink
                                        href={trackingHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        variant={order.status === 'sent' ? 'primary' : 'secondary'}
                                        size="small"
                                        leadingIcon={RiExternalLinkLine}
                                        className="min-h-10 shrink-0 sm:min-h-8"
                                    >
                                        Lacak
                                    </ButtonLink>
                                )
                            )}
                        </div>
                    )}

                    {/* Card Footer: Total + Quick Meta + Detail Trigger */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border pt-4">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption-1-regular text-text-secondary">
                                <span>Total ({totalQty} barang)</span>
                                {order.paymentMethod && (
                                    <>
                                        <span aria-hidden>·</span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <PaymentMark method={order.paymentMethod} className="h-4 w-7" />
                                            <span className="truncate">{order.paymentMethod.name}</span>
                                        </span>
                                    </>
                                )}
                            </div>
                            <p className="mt-0.5 text-title-3-semibold tabular-nums text-text-primary">
                                {formatCurrency(order.total)}
                            </p>
                        </div>

                        <Button
                            variant="secondary"
                            size="medium"
                            onClick={() => setSelectedOrder(order)}
                            trailingIcon={RiArrowRightLine}
                            className="min-h-11 sm:min-h-9"
                        >
                            Lihat detail
                        </Button>
                    </div>
                </div>
            </article>
        )
    }

    if (!token) {
        return (
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
                <Breadcrumb className="mb-6">
                    <BreadcrumbItem href="/cart">Keranjang</BreadcrumbItem>
                    <BreadcrumbItem current>Pesanan Saya</BreadcrumbItem>
                </Breadcrumb>

                <div className="rounded-3xl border border-border-button-default bg-background-full p-8 text-center">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-background-secondary-default text-text-secondary">
                        <RiLoginBoxLine className="size-6" aria-hidden />
                    </div>
                    <h1 className="text-title-2-semibold text-text-primary">Masuk untuk melihat pesanan</h1>
                    <p className="mx-auto mt-2 max-w-md text-body-regular text-text-secondary">
                        Silakan masuk dengan nomor WhatsApp Anda untuk melihat status pembayaran, resi pengiriman, dan riwayat pesanan.
                    </p>
                    <div className="mt-6 flex justify-center">
                        <Link
                            href="/auth"
                            className={cx(
                                buttonStyles.base,
                                buttonStyles.size.medium,
                                buttonStyles.variant.primary,
                                'min-h-11 px-4'
                            )}
                        >
                            <RiLoginBoxLine className={buttonStyles.icon.medium} aria-hidden />
                            <span className={buttonStyles.label.medium}>Masuk Sekarang</span>
                        </Link>
                    </div>
                </div>
                <WhatsappCsButton />
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
            <Breadcrumb className="mb-5">
                <BreadcrumbItem href="/cart">Keranjang</BreadcrumbItem>
                <BreadcrumbItem current>Pesanan Saya</BreadcrumbItem>
            </Breadcrumb>

            {/* Page Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-title-1-semibold text-text-primary">Pesanan saya</h1>
                    <p className="mt-1 text-body-regular text-text-secondary">
                        Pantau pembayaran, lacak pengiriman, dan cek rincian pesanan.
                    </p>
                </div>

                <ButtonLink
                    href={CS_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    size="small"
                    leadingIcon={RiCustomerService2Line}
                    className="min-h-10 w-fit shrink-0 sm:min-h-8"
                >
                    Bantuan CS
                </ButtonLink>
            </div>

            {/* Quick Search */}
            <div className="mb-5">
                <SearchField
                    aria-label="Cari pesanan berdasarkan nomor invoice atau nama produk"
                    placeholder="Cari nomor invoice atau nama produk..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                    shape="rounded"
                    clearLabel="Hapus pencarian"
                />
            </div>

            {/* Status Tabs */}
            <Tabs
                selectedKey={activeTab}
                onSelectionChange={(key) => setActiveTab(key as OrderStatusKey)}
            >
                <TabList aria-label="Status pesanan">
                    {STATUS_TABS.map((tab) => (
                        <Tab
                            key={tab.key}
                            id={tab.key}
                            icon={tab.icon}
                            count={buckets[tab.key].total}
                        >
                            {tab.label}
                        </Tab>
                    ))}
                </TabList>

                {STATUS_TABS.map((tab) => {
                    const rawBucket = buckets[tab.key]
                    const filteredBucket = filteredBuckets[tab.key]

                    return (
                        <TabPanel key={tab.key} id={tab.key} className="mt-2 space-y-4">
                            {rawBucket.loading ? (
                                <div className="space-y-4">
                                    <OrderCardSkeleton />
                                    <OrderCardSkeleton />
                                </div>
                            ) : rawBucket.error ? (
                                <div className="rounded-3xl border border-border-button-default bg-background-full p-8 text-center">
                                    <p className="text-body-medium text-text-error-primary">{rawBucket.error}</p>
                                    <div className="mt-4 flex justify-center">
                                        <Button
                                            variant="primary"
                                            size="medium"
                                            leadingIcon={RiRefreshLine}
                                            onClick={() => fetchBucket(tab.key, rawBucket.page)}
                                            className="min-h-11 sm:min-h-9"
                                        >
                                            Coba Lagi
                                        </Button>
                                    </div>
                                </div>
                            ) : filteredBucket.orders.length > 0 ? (
                                <>
                                    <div className="space-y-4">
                                        {filteredBucket.orders.map((order) => (
                                            <OrderCard key={order.id} order={order} />
                                        ))}
                                    </div>

                                    {!normalizedQuery && rawBucket.totalPages > 1 && (
                                        <div className="pt-2">
                                            <PaginationComponent
                                                currentPage={rawBucket.page}
                                                totalPages={rawBucket.totalPages}
                                                onPageChange={(nextPage) => handlePageChange(tab.key, nextPage)}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="rounded-3xl border border-border-button-default bg-background-full px-6 py-10 text-center">
                                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-background-secondary-default text-text-tertiary">
                                        <tab.icon className="size-6" aria-hidden />
                                    </div>
                                    <h2 className="text-headline-semibold text-text-primary">
                                        {normalizedQuery ? 'Pesanan tidak ditemukan' : tab.emptyTitle}
                                    </h2>
                                    <p className="mx-auto mt-1 max-w-sm text-body-regular text-text-secondary">
                                        {normalizedQuery
                                            ? `Tidak ada pesanan yang cocok dengan "${searchQuery}" di halaman ini.`
                                            : tab.emptyDescription}
                                    </p>
                                    <div className="mt-5 flex justify-center gap-2">
                                        {normalizedQuery ? (
                                            <Button
                                                variant="secondary"
                                                size="medium"
                                                onClick={() => setSearchQuery('')}
                                            >
                                                Reset pencarian
                                            </Button>
                                        ) : (
                                            <Link
                                                href="/cart"
                                                className={cx(
                                                    buttonStyles.base,
                                                    buttonStyles.size.medium,
                                                    buttonStyles.variant.secondary,
                                                    'min-h-11 sm:min-h-9'
                                                )}
                                            >
                                                <RiShoppingBag3Line className={buttonStyles.icon.medium} aria-hidden />
                                                <span className={buttonStyles.label.medium}>Lihat Keranjang</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}
                        </TabPanel>
                    )
                })}
            </Tabs>

            {/* Order Detail Modal (desktop) / Bottom Drawer (mobile) */}
            <Dialog open={selectedOrder !== null} onOpenChange={(open) => !open && setSelectedOrder(null)}>
                <DialogContent aria-label="Detail pesanan">
                    {selectedOrder && (() => {
                        const isPickup = selectedOrder.shipping?.title === 'Ambil di Toko'
                        const statusMeta = getStatusMeta(selectedOrder.status, selectedOrder.shipping?.title)
                        const subtotal = selectedOrder.products.reduce(
                            (sum, item) => sum + Number(item.price) * item.qty,
                            0
                        )

                        return (
                            <div className="space-y-5">
                                <DialogHeader>
                                    <div className="flex flex-wrap items-center gap-2 pe-8">
                                        <DialogTitle className="break-all tabular-nums" dir="ltr">
                                            {selectedOrder.invoice}
                                        </DialogTitle>
                                        <Chip variant="bold" color={statusMeta.color}>
                                            {statusMeta.label}
                                        </Chip>
                                    </div>
                                    <DialogDescription>
                                        Dipesan pada {formatDate(selectedOrder.createdAt)}
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Products */}
                                <section className="space-y-3">
                                    <h4 className="text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
                                        Produk ({selectedOrder.products.length})
                                    </h4>
                                    <ul className="space-y-3">
                                        {selectedOrder.products.map((item, idx) => (
                                            <li key={`${item.id}-${idx}`} className="flex items-start gap-3">
                                                <img
                                                    src={item.images[0]?.src}
                                                    alt=""
                                                    width={48}
                                                    height={48}
                                                    className="size-12 shrink-0 rounded-xl border border-separator-border bg-background-secondary-default object-contain"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-body-medium text-text-primary">{item.name}</p>
                                                    <div className="mt-0.5 flex justify-between gap-2 text-caption-1-regular text-text-secondary">
                                                        <span>
                                                            {item.qty} × {formatCurrency(Number(item.price))}
                                                        </span>
                                                        <span className="font-medium tabular-nums text-text-primary">
                                                            {formatCurrency(Number(item.price) * item.qty)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <Divider />

                                {/* Delivery & Payment Info */}
                                <section className="space-y-3 text-body-regular">
                                    <h4 className="text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
                                        Pengiriman & Pembayaran
                                    </h4>

                                    {selectedOrder.shipping && (
                                        <div className="flex items-start gap-2.5">
                                            <RiTruckLine className="mt-0.5 size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                                            <div className="min-w-0">
                                                <p className="text-body-medium text-text-primary">
                                                    {selectedOrder.shipping.title}
                                                    {!isPickup && (selectedOrder.courierName || selectedOrder.courierServiceName) && (
                                                        <> · {[selectedOrder.courierName, selectedOrder.courierServiceName].filter(Boolean).join(' ')}</>
                                                    )}
                                                </p>
                                                {!isPickup && selectedOrder.biteshipStatusLabel && (
                                                    <p className="text-caption-1-medium text-text-secondary">
                                                        Status: {selectedOrder.biteshipStatusLabel}
                                                    </p>
                                                )}
                                                {!isPickup && selectedOrder.trackingNumber && (
                                                    <p className="mt-0.5 text-caption-1-regular text-text-secondary">
                                                        Resi:{' '}
                                                        <span className="font-medium tabular-nums text-text-primary" dir="ltr">
                                                            {selectedOrder.trackingNumber}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {selectedOrder.address && (
                                        <div className="flex items-start gap-2.5">
                                            <RiMapPinLine className="mt-0.5 size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                                            <p className="text-body-regular text-text-secondary">{selectedOrder.address}</p>
                                        </div>
                                    )}

                                    {selectedOrder.paymentMethod && (
                                        <div className="flex items-center gap-2.5">
                                            <RiBankCardLine className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                                            <div className="flex items-center gap-2">
                                                <PaymentMark method={selectedOrder.paymentMethod} className="h-6 w-10" />
                                                <span className="text-body-medium text-text-primary">
                                                    {selectedOrder.paymentMethod.name}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {(selectedOrder.voucher || selectedOrder.shippingVoucher) && (
                                        <div className="flex items-start gap-2.5">
                                            <RiCoupon3Line className="mt-0.5 size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                                            <div className="space-y-0.5 text-caption-1-regular text-text-secondary">
                                                {selectedOrder.voucher && <p>Voucher: {selectedOrder.voucher.name}</p>}
                                                {selectedOrder.shippingVoucher && <p>Voucher ongkir: {selectedOrder.shippingVoucher.name}</p>}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <Divider />

                                {/* Price Breakdown */}
                                <section className="space-y-2 text-body-regular">
                                    <h4 className="text-caption-1-semibold uppercase tracking-wide text-text-tertiary">
                                        Rincian Pembayaran
                                    </h4>
                                    <dl className="space-y-2 pt-1">
                                        <div className="flex justify-between gap-4">
                                            <dt className="text-text-secondary">Subtotal produk</dt>
                                            <dd className="tabular-nums text-text-primary">{formatCurrency(subtotal)}</dd>
                                        </div>
                                        {selectedOrder.ongkir !== undefined && (
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-text-secondary">Ongkos kirim</dt>
                                                <dd className="tabular-nums text-text-primary">{formatCurrency(selectedOrder.ongkir)}</dd>
                                            </div>
                                        )}
                                        {selectedOrder.adminFee !== undefined && selectedOrder.adminFee > 0 && (
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-text-secondary">Biaya admin</dt>
                                                <dd className="tabular-nums text-text-primary">{formatCurrency(selectedOrder.adminFee)}</dd>
                                            </div>
                                        )}
                                        {selectedOrder.voucherDiscount !== undefined && selectedOrder.voucherDiscount > 0 && (
                                            <div className="flex justify-between gap-4 text-status-lime-text">
                                                <dt>Diskon voucher</dt>
                                                <dd className="font-medium tabular-nums">-{formatCurrency(selectedOrder.voucherDiscount)}</dd>
                                            </div>
                                        )}
                                        {selectedOrder.shippingVoucherDiscount !== undefined && selectedOrder.shippingVoucherDiscount > 0 && (
                                            <div className="flex justify-between gap-4 text-status-lime-text">
                                                <dt>Diskon ongkir</dt>
                                                <dd className="font-medium tabular-nums">-{formatCurrency(selectedOrder.shippingVoucherDiscount)}</dd>
                                            </div>
                                        )}
                                        <div className="flex items-baseline justify-between gap-4 border-t border-separator-border pt-3">
                                            <dt className="text-body-medium font-semibold text-text-primary">Total pembayaran</dt>
                                            <dd className="text-title-3-semibold tabular-nums text-text-primary">
                                                {formatCurrency(selectedOrder.total)}
                                            </dd>
                                        </div>
                                    </dl>
                                </section>
                            </div>
                        )
                    })()}
                </DialogContent>
            </Dialog>

            <WhatsappCsButton />
        </div>
    )
}

export default OrderPage
