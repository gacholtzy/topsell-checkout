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
                return 'bg-yellow-500'
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

    const OrderCard = ({ order }: { order: Order }) => (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-semibold">
                            #{order.invoice}
                        </CardTitle>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(order.createdAt)}
                        </div>
                    </div>
                    <Badge className={`${getStatusColor(order.status)} text-white`}>
                        <div className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {getStatusLabel(order.status, order.shipping?.title)}
                        </div>
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Order Items */}
                    <div className="space-y-2">
                        {order.products.map((item, index) => (

                            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-2 mr-4">
                                    <img src={item.images[0]?.src} alt={item.name} className="w-10 h-10 rounded-md" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">{item.name}</p>
                                    <div className='flex items-center justify-between'>
                                        <p className="text-sm text-gray-500">Qty: {item.qty}</p>
                                        <div className="text-right">
                                            <p className="font-medium">{formatCurrency(Number(item.price) * item.qty)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order Summary */}
                    <div className="border-t pt-3 space-y-2">
                        {/* Subtotal */}
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span>{formatCurrency(order.products.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0))}</span>
                        </div>

                        {/* Shipping Cost */}
                        {order.ongkir !== undefined && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Ongkir</span>
                                <span>{formatCurrency(order.ongkir)}</span>
                            </div>
                        )}

                        {/* Admin Fee */}
                        {order.adminFee !== undefined && order.adminFee > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">Biaya Admin</span>
                                <span>{formatCurrency(order.adminFee)}</span>
                            </div>
                        )}

                        {/* Voucher Discount */}
                        {order.voucherDiscount !== undefined && order.voucherDiscount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-green-600">Diskon Voucher</span>
                                <span className="text-green-600">-{formatCurrency(order.voucherDiscount)}</span>
                            </div>
                        )}

                        {/* Shipping Voucher Discount */}
                        {order.shippingVoucherDiscount !== undefined && order.shippingVoucherDiscount > 0 && (
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-green-600">Diskon Voucher Pengiriman</span>
                                <span className="text-green-600">-{formatCurrency(order.shippingVoucherDiscount)}</span>
                            </div>
                        )}

                        <div className="border-t pt-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center text-sm text-gray-600">
                                    <DollarSign className="h-4 w-4 mr-1" />
                                    Total Pembayaran
                                </div>
                                <p className="text-lg font-bold text-green-600">
                                    {formatCurrency(order.total)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-2">
                        {order.address && (
                            <div className="text-sm text-gray-600">
                                <p><strong>Alamat Pengiriman:</strong> {order.address}</p>
                            </div>
                        )}

                        {order.shipping && (
                            <div className="text-sm text-gray-600">
                                <p>
                                    <strong>Metode Pengiriman:</strong> {order.shipping.title}
                                    {order.shipping.title !== "Ambil di Toko" && (order.courierName || order.courierServiceName) && (
                                        <> · {[order.courierName, order.courierServiceName].filter(Boolean).join(' ')}</>
                                    )}
                                </p>
                                {order.shipping.title !== "Ambil di Toko" && order.biteshipStatusLabel && (
                                    <p className="text-blue-700">{order.biteshipStatusLabel}</p>
                                )}
                            </div>
                        )}

                        {/* Booked at Biteship but the courier has not issued a resi yet:
                            the tracking page already works, so offer it. */}
                        {order.shipping?.title !== "Ambil di Toko" && !order.trackingNumber && order.biteshipTrackingID && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-gray-700 flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-blue-600" /> Kurir sedang disiapkan, nomor resi menyusul.</span>
                                <Button asChild size="sm" className="bg-red-500 hover:bg-red-600">
                                    <Link href={`/tracking/${order.invoice}`}>Lacak Paket</Link>
                                </Button>
                            </div>
                        )}

                        {/* The resi only means something for a parcel that travels to an
                            address. A pickup order has no courier, so it never shows one,
                            whatever was typed into the dashboard. */}
                        {order.shipping?.title !== "Ambil di Toko" && order.trackingNumber && (
                            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                    <Truck className="h-4 w-4 text-blue-600" />
                                    <strong>No. Resi{order.courierName ? ` (${order.courierName})` : ''}</strong>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-base break-all">{order.trackingNumber}</span>
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
                                        <Button asChild size="sm" className="bg-red-500 hover:bg-red-600">
                                            <Link href={order.trackingUrl}>Lacak Paket</Link>
                                        </Button>
                                    ) : order.trackingUrl ? (
                                        <Button asChild size="sm" className="bg-red-500 hover:bg-red-600">
                                            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                                                Lacak
                                            </a>
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {order.paymentMethod && (
                            <div className="text-sm text-gray-600 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span><strong>Pembayaran:</strong></span>
                                    <span className='flex items-center gap-2'>
                                    <img src={order.paymentMethod.icon} alt={order.paymentMethod.name} className="w-10" />
                                    {order.paymentMethod.name}
                                    </span>
                                </div>
                            </div>
                        )}

                        {order.voucher && (
                            <div className="text-sm text-gray-600">
                                <p><strong>Voucher:</strong> {order.voucher.name}</p>
                            </div>
                        )}

                        {order.shippingVoucher && (
                            <div className="text-sm text-gray-600">
                                <p><strong>Voucher Pengiriman:</strong> {order.shippingVoucher.name}</p>
                            </div>
                        )}
                    </div>

                    {/* Only an unpaid order can still be paid. */}
                    {order.status === 'pending' && (
                        <PaymentPanel order={order} loadedAt={pendingLoadedAt} />
                    )}
                </div>
            </CardContent>
        </Card>
    )

    const OrderList = ({ orders, emptyMessage }: { orders: Order[], emptyMessage: string }) => (
        <div>
            {orders.length > 0 ? (
                orders.map(order => (
                    <OrderCard key={order.id} order={order} />
                ))
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{emptyMessage}</p>
                </div>
            )}
        </div>
    )

    if (loading) {
        return (
            <div className="container mx-auto max-w-4xl px-4 py-8">
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container mx-auto max-w-4xl px-4 py-8">
                <div className="text-center py-12">
                    <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                                            <p className="text-red-500 mb-4">{error}</p>
                        <button
                            onClick={() => {
                                fetchOrderHistory("pending", pendingPage)
                                fetchOrderHistory("proses", prosesPage)
                                fetchOrderHistory("sent", sendedPage)
                                fetchOrderHistory("complete", completePage)
                                fetchOrderHistory("expired", expiredPage)
                            }}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Coba Lagi
                        </button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Pesanan Saya</h1>
                <p className="text-gray-600">Lacak dan kelola riwayat pesanan Anda</p>
                <p className="mt-2 text-sm text-gray-600">
                    Ada kendala dengan pesanan? Hubungi CS kami via{' '}
                    <a href={CS_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-600 underline">
                        WhatsApp
                    </a>.
                </p>
            </div>
            <div className="mb-8">
                <Button
                    asChild>
                    <Link href="/cart">
                        <ArrowLeftIcon className="h-4 w-4" />
                        Kembali ke Keranjang
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 h-20 md:h-10">
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
