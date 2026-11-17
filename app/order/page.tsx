"use client"

import React, { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Package, Clock, Truck, CheckCircle, XCircle, Calendar, DollarSign, ArrowLeftIcon } from 'lucide-react'
import { useAuthStore } from '@/lib/useAuthStore'
import { getOrderHistory, Order } from '@/lib/order-utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PaginationComponent } from '@/components/PaginationComponent'
import PaymentPanel from '@/components/payment-panel'
import WhatsappCsButton, { CS_WHATSAPP_URL } from '@/components/whatsapp-cs-button'

const OrderPage = () => {
    const [pendingOrders, setPendingOrders] = useState<Order[]>([])
    // When the unpaid list arrived. Each order reports its time left as of THAT
    // moment, so the countdown needs it to keep counting down from there.
    const [pendingLoadedAt, setPendingLoadedAt] = useState<number>(() => Date.now())
    const [prosesOrders, setProsesOrders] = useState<Order[]>([])
    const [sendedOrders, setSendedOrders] = useState<Order[]>([])
    const [completeOrders, setCompleteOrders] = useState<Order[]>([])
    const [expiredOrders, setExpiredOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>("")
    const { toast } = useToast()
    const { token } = useAuthStore()
    const [pendingPage, setPendingPage] = useState(1)
    const [prosesPage, setProsesPage] = useState(1)
    const [sendedPage, setSendedPage] = useState(1)
    const [completePage, setCompletePage] = useState(1)
    const [expiredPage, setExpiredPage] = useState(1)

    const [pendingTotal, setPendingTotal] = useState(0)
    const [pendingTotalPages, setPendingTotalPages] = useState(0)
    const [prosesTotal, setProsesTotal] = useState(0)
    const [prosesTotalPages, setProsesTotalPages] = useState(0)
    const [sendedTotal, setSendedTotal] = useState(0)
    const [sendedTotalPages, setSendedTotalPages] = useState(0)
    const [completeTotal, setCompleteTotal] = useState(0)
    const [completeTotalPages, setCompleteTotalPages] = useState(0)
    const [expiredTotal, setExpiredTotal] = useState(0)
    const [expiredTotalPages, setExpiredTotalPages] = useState(0)

    const fetchOrderHistory = async (status: string, page: number) => {
        try {
            setLoading(true)

            if (!token) {
                setError("Authentication required")
                toast({
                    title: 'Error',
                    description: 'Silakan login untuk melihat pesanan Anda',
                    variant: "destructive"
                })
                return
            }

            const results = await getOrderHistory(token, status, page, 5)

            if (results.status !== 200) {
                throw new Error(results.message || 'Gagal mengambil riwayat pesanan')
            }
            
            switch (status) {
                case "pending":
                    setPendingTotal(results.total)
                    setPendingTotalPages(results.totalPage)
                    setPendingOrders(results.data || [])
                    setPendingLoadedAt(Date.now())
                    break
                case "proses":
                    setProsesTotal(results.total)
                    setProsesTotalPages(results.totalPage)
                    setProsesOrders(results.data || [])
                    break
                case "sent":
                    setSendedTotal(results.total)
                    setSendedTotalPages(results.totalPage)
                    setSendedOrders(results.data || [])
                    break
                case "complete":
                    setCompleteTotal(results.total)
                    setCompleteTotalPages(results.totalPage)
                    setCompleteOrders(results.data || [])
                    break
                case "expired":
                    setExpiredTotal(results.total)
                    setExpiredTotalPages(results.totalPage)
                    setExpiredOrders(results.data || [])
                    break
            }
            setError("")
        } catch (error) {
            console.error('Error fetching order history:', error)
            setError(error instanceof Error ? error.message : 'Gagal mengambil pesanan')
            toast({
                title: 'Error',
                description: 'Gagal mengambil riwayat pesanan',
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }


    useEffect(() => {
        fetchOrderHistory("pending", pendingPage)
        fetchOrderHistory("proses", prosesPage)
        fetchOrderHistory("sent", sendedPage)
        fetchOrderHistory("complete", completePage)
        fetchOrderHistory("expired", expiredPage)
    }, [token])

    useEffect(() => {
        fetchOrderHistory("pending", pendingPage)
    }, [pendingPage])

    useEffect(() => {
        fetchOrderHistory("proses", prosesPage)
    }, [prosesPage])

    useEffect(() => {
        fetchOrderHistory("sent", sendedPage)
    }, [sendedPage])

    useEffect(() => {
        fetchOrderHistory("complete", completePage)
    }, [completePage])

    useEffect(() => {
        fetchOrderHistory("expired", expiredPage)
    }, [expiredPage])

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4" />
            case 'proses':
                return <Package className="h-4 w-4" />
            case 'sent':
                return <Truck className="h-4 w-4" />
            case 'complete':
                return <CheckCircle className="h-4 w-4" />
            case 'expired':
                return <XCircle className="h-4 w-4" />
            case 'testing':
                return <Package className="h-4 w-4" />
            default:
                return <Clock className="h-4 w-4" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending':
                return 'bg-warning-soft0'
            case 'proses':
                return 'bg-blue-500'
            case 'sent':
                return 'bg-purple-500'
            case 'complete':
                return 'bg-green-500'
            case 'expired':
                return 'bg-red-500'
            case 'testing':
                return 'bg-gray-500'
            default:
                return 'bg-gray-500'
        }
    }

    const getStatusLabel = (status: string, shippingTitle?: string) => {
        const isAmbilDiToko = shippingTitle === "Ambil di Toko"
        
        switch (status) {
            case 'pending':
                return 'Belum Bayar'
            case 'proses':
                return 'Diproses'
            case 'sent':
                return isAmbilDiToko ? 'Ambil di Toko' : 'Dikirim'
            case 'complete':
                return 'Selesai'
            case 'expired':
                return 'Kadaluarsa'
            case 'testing':
                return 'Testing'
            default:
                return status.toUpperCase()
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const statusTone = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-warning-soft text-warning'
            case 'complete': return 'bg-success-soft text-success'
            case 'expired': return 'bg-secondary text-muted-foreground'
            default: return 'bg-secondary text-foreground'
        }
    }

    const OrderCard = ({ order }: { order: Order }) => {
        const isPickup = order.shipping?.title === "Ambil di Toko"
        return (
        <article className="rounded-lg border bg-card">
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b p-4 sm:px-6">
                <div className="min-w-0">
                    <h3 className="break-all text-base font-bold">{order.invoice}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-semibold ${statusTone(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {getStatusLabel(order.status, order.shipping?.title)}
                </span>
            </header>

            <div className="space-y-5 p-4 sm:px-6 sm:py-5">
                <ul className="space-y-3">
                    {order.products.map((item, index) => (
                        <li key={index} className="flex gap-3">
                            <img src={item.images[0]?.src} alt="" className="h-14 w-14 shrink-0 rounded-md border bg-secondary object-contain" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold leading-snug">{item.name}</p>
                                <p className="mt-0.5 flex justify-between gap-3 text-sm text-muted-foreground">
                                    <span>{item.qty} barang</span>
                                    <span className="font-semibold tabular-nums text-foreground">{formatCurrency(Number(item.price) * item.qty)}</span>
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>

                <dl className="space-y-2 border-t pt-4 text-sm">
                    <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Subtotal</dt>
                        <dd className="tabular-nums">{formatCurrency(order.products.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0))}</dd>
                    </div>
                    {order.ongkir !== undefined && (
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Ongkos kirim</dt><dd className="tabular-nums">{formatCurrency(order.ongkir)}</dd></div>
                    )}
                    {order.adminFee !== undefined && order.adminFee > 0 && (
                        <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Biaya admin</dt><dd className="tabular-nums">{formatCurrency(order.adminFee)}</dd></div>
                    )}
                    {order.voucherDiscount !== undefined && order.voucherDiscount > 0 && (
                        <div className="flex justify-between gap-4 text-success"><dt>Diskon voucher</dt><dd className="font-semibold tabular-nums">-{formatCurrency(order.voucherDiscount)}</dd></div>
                    )}
                    {order.shippingVoucherDiscount !== undefined && order.shippingVoucherDiscount > 0 && (
                        <div className="flex justify-between gap-4 text-success"><dt>Diskon ongkir</dt><dd className="font-semibold tabular-nums">-{formatCurrency(order.shippingVoucherDiscount)}</dd></div>
                    )}
                    <div className="flex items-baseline justify-between gap-4 border-t pt-3">
                        <dt className="font-bold">Total pembayaran</dt>
                        <dd className="text-lg font-extrabold tabular-nums">{formatCurrency(order.total)}</dd>
                    </div>
                </dl>

                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
                    {order.address && (<><dt className="text-muted-foreground">Alamat</dt><dd>{order.address}</dd></>)}
                    {order.shipping && (
                        <>
                            <dt className="text-muted-foreground">Pengiriman</dt>
                            <dd>
                                {order.shipping.title}
                                {!isPickup && (order.courierName || order.courierServiceName) && (
                                    <> · {[order.courierName, order.courierServiceName].filter(Boolean).join(' ')}</>
                                )}
                                {!isPickup && order.biteshipStatusLabel && (
                                    <span className="block font-semibold">{order.biteshipStatusLabel}</span>
                                )}
                            </dd>
                        </>
                    )}
                    {order.paymentMethod && (
                        <>
                            <dt className="text-muted-foreground">Pembayaran</dt>
                            <dd className="flex items-center gap-2"><img src={order.paymentMethod.icon} alt="" className="h-5 w-8 object-contain" />{order.paymentMethod.name}</dd>
                        </>
                    )}
                    {order.voucher && (<><dt className="text-muted-foreground">Voucher</dt><dd>{order.voucher.name}</dd></>)}
                    {order.shippingVoucher && (<><dt className="text-muted-foreground">Voucher ongkir</dt><dd>{order.shippingVoucher.name}</dd></>)}
                </dl>

                {/* Booked with the courier but no resi yet: the tracking page already works. */}
                {!isPickup && !order.trackingNumber && order.biteshipTrackingID && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary px-4 py-3 text-sm">
                        <span>Kurir sedang disiapkan. Nomor resi menyusul.</span>
                        <Button asChild size="sm"><Link href={`/tracking/${order.invoice}`}>Lacak paket</Link></Button>
                    </div>
                )}

                {/* A resi only means something for a parcel that travels to an address. */}
                {!isPickup && order.trackingNumber && (
                    <div className="rounded-lg bg-secondary px-4 py-3 text-sm">
                        <p className="text-muted-foreground">No. resi{order.courierName ? ` · ${order.courierName}` : ''}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="break-all text-base font-bold tabular-nums">{order.trackingNumber}</span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    // Customers paste the resi into the courier's own app.
                                    try {
                                        await navigator.clipboard.writeText(order.trackingNumber!)
                                        toast({ title: 'Nomor resi disalin' })
                                    } catch {
                                        toast({ title: 'Gagal menyalin', description: 'Salin nomor resi secara manual.', variant: 'destructive' })
                                    }
                                }}
                            >
                                Salin
                            </Button>
                            {order.trackingUrl && order.trackingUrl.startsWith('/') ? (
                                // Our own tracking page (Biteship shipments): same tab.
                                <Button asChild size="sm"><Link href={order.trackingUrl}>Lacak paket</Link></Button>
                            ) : order.trackingUrl ? (
                                <Button asChild size="sm"><a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">Lacak</a></Button>
                            ) : null}
                        </div>
                    </div>
                )}

                {/* Only an unpaid order can still be paid. */}
                {order.status === 'pending' && (
                    <PaymentPanel order={order} loadedAt={pendingLoadedAt} />
                )}
            </div>
        </article>
        )
    }

    const OrderList = ({ orders, emptyMessage }: { orders: Order[], emptyMessage: string }) => (
        <div className="space-y-4">
            {orders.length > 0 ? (
                orders.map(order => (
                    <OrderCard key={order.id} order={order} />
                ))
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    
                    <p>{emptyMessage}</p>
                </div>
            )}
        </div>
    )

    if (loading) {
        return (
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
                <div className="flex justify-center items-center py-12">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" role="status" aria-label="Memuat" />
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
                <div className="text-center py-12">
                    
                                            <p className="text-primary mb-4">{error}</p>
                        <button
                            onClick={() => {
                                fetchOrderHistory("pending", pendingPage)
                                fetchOrderHistory("proses", prosesPage)
                                fetchOrderHistory("sent", sendedPage)
                                fetchOrderHistory("complete", completePage)
                                fetchOrderHistory("expired", expiredPage)
                            }}
                            className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                            Coba Lagi
                        </button>
                </div>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
            <div className="mb-8">
                <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Pesanan saya</h1>
                <p className="text-muted-foreground">Lacak dan kelola riwayat pesanan Anda</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Ada kendala dengan pesanan? Hubungi CS kami via{' '}
                    <a href={CS_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
                        WhatsApp
                    </a>.
                </p>
            </div>
            <div className="mb-8">
                <Button
                    asChild variant="outline" size="sm">
                    <Link href="/cart">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Kembali ke Keranjang
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1.5">
                    <TabsTrigger value="pending" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Belum Bayar ({pendingTotal})
                    </TabsTrigger>
                    <TabsTrigger value="proses" className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Diproses ({prosesTotal})
                    </TabsTrigger>
                    <TabsTrigger value="sent" className="flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Dikirim / Ambil di Toko ({sendedTotal})
                    </TabsTrigger>
                    <TabsTrigger value="complete" className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Selesai ({completeTotal})
                    </TabsTrigger>
                    <TabsTrigger value="expired" className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Kadaluarsa ({expiredTotal})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-6">
                    <OrderList
                        orders={pendingOrders}
                        emptyMessage="Tidak ada pesanan yang belum dibayar"
                    />
                    {
                        pendingTotalPages > 1 && (
                        <PaginationComponent
                            currentPage={pendingPage}
                            totalPages={pendingTotalPages}
                            onPageChange={setPendingPage}
                        />
                    )}
                </TabsContent>

                <TabsContent value="proses" className="mt-6">
                    <OrderList
                        orders={prosesOrders}
                        emptyMessage="Tidak ada pesanan yang sedang diproses"
                    />
                    {
                        prosesTotalPages > 1 && (
                            <PaginationComponent
                                currentPage={prosesPage}
                                totalPages={prosesTotalPages}
                                onPageChange={setProsesPage}
                            />
                        )
                    }
                </TabsContent>

                <TabsContent value="sent" className="mt-6">
                    <OrderList
                        orders={sendedOrders}
                        emptyMessage="Tidak ada pesanan yang dikirim atau ambil di toko"
                    />
                    {
                        sendedTotalPages > 1 && (
                            <PaginationComponent
                                currentPage={sendedPage}
                                totalPages={sendedTotalPages}
                                onPageChange={setSendedPage}
                            />
                        )
                    }
                </TabsContent>

                <TabsContent value="complete" className="mt-6">
                    <OrderList
                        orders={completeOrders}
                        emptyMessage="Tidak ada pesanan yang selesai"
                    />
                    {
                        completeTotalPages > 1 && (
                            <PaginationComponent
                                currentPage={completePage}
                                totalPages={completeTotalPages}
                                onPageChange={setCompletePage}
                            />
                        )
                    }
                </TabsContent>

                <TabsContent value="expired" className="mt-6">
                    <OrderList
                        orders={expiredOrders}
                        emptyMessage="Tidak ada pesanan yang kadaluarsa"
                    />
                    {
                        expiredTotalPages > 1 && (
                            <PaginationComponent
                                currentPage={expiredPage}
                                totalPages={expiredTotalPages}
                                onPageChange={setExpiredPage}
                            />
                        )
                    }
                </TabsContent>
            </Tabs>
            <WhatsappCsButton />
        </div>
    )
}

export default OrderPage
