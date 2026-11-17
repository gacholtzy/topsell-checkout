"use client"
import { Order } from "../../interface/order"
import React, { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "../../hooks/use-toast"
import { Badge } from "../../components/ui/badge"
import { priceToIDR } from "../../lib/helper"
import { Separator } from "../../components/ui/separator"
import { Button } from "../../components/ui/button"
import { CopyIcon } from "lucide-react"
import Link from "next/link"

// Main page component
const ManualPage = () => {
    return (
        <Suspense fallback={
            <div className="flex justify-center my-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        }>
            <ManualPageContent />
        </Suspense>
    )
}

// Inner component that uses useSearchParams
const ManualPageContent = () => {
    // get invoice from url
    const searchParams = useSearchParams()
    const invoice = searchParams.get("inv")
    const [isLoading, setIsLoading] = React.useState(false)
    const [order, setOrder] = React.useState<Order | null>(null)
    const [timeLeft, setTimeLeft] = React.useState<{
        hours: number;
        minutes: number;
        seconds: number;
    } | null>(null)
    const [deadline, setDeadline] = React.useState<string | null>(null)
    const [redirectCountdown, setRedirectCountdown] = React.useState<number | null>(null)

    // Handle back button navigation
    React.useEffect(() => {
        if (typeof window !== "undefined") {
            // Add multiple history entries to ensure back button is captured
            window.history.pushState({ page: "manual" }, "", window.location.href);
            window.history.pushState({ page: "manual" }, "", window.location.href);
            
        // Set up onpopstate handler
        window.onpopstate = (event: PopStateEvent) => {
            event.preventDefault();
            window.location.href = "https://topsellbelanja.com";
        };
        
        // Cleanup function
            return () => {
                window.onpopstate = null;
            };
        }
    }, []);

    // Handle expired order redirect
    React.useEffect(() => {
        // Check if order is expired by status or by time
        const isExpiredByStatus = order?.status === "expired";
        const isExpiredByTime = order?.createdAt ? 
            (new Date().getTime() - new Date(order.createdAt).getTime() > 24 * 60 * 60 * 1000) : 
            false;
            
        if (isExpiredByStatus || isExpiredByTime) {
            // If order is expired by time but status hasn't been updated yet
            if (!isExpiredByStatus && isExpiredByTime) {
                // Update local state to show expired UI
                setOrder(prev => prev ? {...prev, status: "expired"} : null);
            }
            
            setRedirectCountdown(5);
            
            const timer = setInterval(() => {
                setRedirectCountdown(prev => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        clearInterval(timer);
                        window.location.replace("https://topsellbelanja.com");
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
            return () => clearInterval(timer);
        }
    }, [order?.status, order?.createdAt]);

    const fetchOrder = async () => {
        try {
            setIsLoading(true)
            const res = await fetch(`/backend/orders?invoice=${invoice}`)
            const data = await res.json()
            setOrder(data.data)
            setDeadline(formatDeadline(data.data.createdAt))
        } catch (error) {
            toast({
                title: "Gagal mengambil data order",
                description: "Silakan coba lagi nanti",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const formatDeadline = (date: string) => {
        const createdAtDate = new Date(date)
        // Calculate deadline (24 hours after creation)
        const deadlineDate = new Date(createdAtDate.getTime() + 24 * 60 * 60 * 1000)

        const day = deadlineDate.toLocaleDateString('id-ID', { weekday: 'long' })
        const dateString = deadlineDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })

        // Format time as HH:MM
        const hours = String(deadlineDate.getHours()).padStart(2, '0')
        const minutes = String(deadlineDate.getMinutes()).padStart(2, '0')
        const timeString = `${hours}:${minutes}`

        return `${day}, ${dateString} pukul ${timeString} WIB`
    }

    // Calculate time left from order creation time
    const calculateTimeLeft = () => {
        if (!order?.createdAt) return null

        // Parse the createdAt timestamp
        const createdAtTime = new Date(order.createdAt).getTime()

        // Calculate deadline (24 hours after creation)
        const deadlineTime = createdAtTime + 24 * 60 * 60 * 1000

        // Calculate time left
        const now = new Date().getTime()
        const difference = deadlineTime - now

        // If deadline has passed
        if (difference <= 0) {
            // If the order status hasn't been updated to expired yet, update it locally
            if (order.status !== "expired") {
                setOrder(prev => prev ? {...prev, status: "expired"} : null);
            }
            return { hours: 0, minutes: 0, seconds: 0 }
        }

        // Calculate hours, minutes, seconds
        const hours = Math.floor(difference / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)

        return { hours, minutes, seconds }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast({
            title: "Berhasil menyalin nomor rekening",
            description: "Silakan paste ke bank",
        })
    }

    React.useEffect(() => {
        fetchOrder()
    }, [])

    React.useEffect(() => {
        if (!order?.createdAt) return

        // Initial calculation
        setTimeLeft(calculateTimeLeft())

        // Update countdown every second
        const timer = setInterval(() => {
            const updatedTimeLeft = calculateTimeLeft()
            setTimeLeft(updatedTimeLeft)

            // Clear interval when countdown reaches zero
            if (updatedTimeLeft?.hours === 0 &&
                updatedTimeLeft?.minutes === 0 &&
                updatedTimeLeft?.seconds === 0) {
                clearInterval(timer)
            }
        }, 1000)

        // Cleanup interval on unmount
        return () => clearInterval(timer)
    }, [order])

    // Which company receives the transfer depends on what was bought.
    const hasElektronik = !!order?.products.some(product =>
        product.categories?.some(category => category.name.toLowerCase() == "elektronik")
    )
    const hasSepedaListrik = !!order?.products.some(product =>
        product.categories?.some(category => category.name.toLowerCase() == "sepeda listrik")
    )
    const bankAccounts = !hasElektronik && hasSepedaListrik
        ? [
            { bank: "BCA", holder: "PT Tri Kasih Karunia", number: "6105863636" },
            { bank: "Mandiri", holder: "PT Tri Kasih Karunia", number: "1420500068878" },
        ]
        : [
            { bank: "BCA", holder: "PT. Topsel Raharja Indonesia", number: "6105777721" },
            { bank: "Mandiri", holder: "PT. Topsel Raharja Indonesia", number: "1420099191990" },
        ]
    const pad = (n: number) => String(n).padStart(2, '0')

    return (
        <div className='mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10'>
            {isLoading ? (
                <div className="flex justify-center py-16" role="status" aria-label="Memuat pesanan">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                </div>
            ) : order?.status === "expired" ? (
                <div className="rounded-3xl border border-border-button-default bg-background-full p-6 text-center sm:p-10">
                    <h1 className="text-2xl font-extrabold tracking-tight">Pesanan kedaluwarsa</h1>
                    <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                        Pesanan <span className="font-semibold text-foreground">{order.invoice}</span> melewati batas waktu pembayaran dan dibatalkan otomatis.
                        Buat pesanan baru untuk melanjutkan belanja.
                    </p>
                    <p className="mt-6 text-sm text-muted-foreground" role="status">
                        Kembali ke beranda dalam <span className="font-bold tabular-nums text-foreground">{redirectCountdown}</span> detik
                    </p>
                    <Button className="mt-4" size="lg" onClick={() => window.location.replace("https://topsellbelanja.com")}>
                        Kembali ke beranda
                    </Button>
                </div>
            ) : (
                <>
                    <p className="text-sm font-semibold text-muted-foreground">Pesanan {order?.invoice}</p>
                    <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Selesaikan pembayaran</h1>

                    <div className="mt-6 rounded-3xl border border-border-button-default bg-background-full">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-6">
                            <div>
                                <p className="text-sm text-muted-foreground">Bayar sebelum</p>
                                <p className="font-semibold">{deadline}</p>
                            </div>
                            {timeLeft && (
                                <p className="rounded-md bg-warning-soft px-3 py-2 text-lg font-extrabold tabular-nums text-warning" role="timer" aria-label="Sisa waktu pembayaran">
                                    {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
                            <div>
                                <p className="text-sm text-muted-foreground">Transfer tepat sebesar</p>
                                <p className="text-2xl font-extrabold tabular-nums sm:text-3xl">{priceToIDR(order?.total || 0)}</p>
                            </div>
                            <Button variant="outline" onClick={() => copyToClipboard(order?.total.toString() || "")}>
                                <CopyIcon /> Salin
                            </Button>
                        </div>
                    </div>

                    <h2 className="mb-3 mt-8 text-lg font-bold">Transfer ke salah satu rekening</h2>
                    <ul className="divide-y rounded-3xl border border-border-button-default bg-background-full">
                        {bankAccounts.map((acc) => (
                            <li key={acc.number} className="flex items-center justify-between gap-3 p-4 sm:p-5">
                                <div className="min-w-0">
                                    <p className="text-sm text-muted-foreground">{acc.bank} · {acc.holder}</p>
                                    <p className="text-lg font-bold tabular-nums tracking-wide">{acc.number}</p>
                                </div>
                                <Button variant="outline" onClick={() => copyToClipboard(acc.number)}>
                                    <CopyIcon /> Salin
                                </Button>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Setelah transfer, pesanan diproses otomatis saat pembayaran terkonfirmasi. Simpan bukti transfer sampai pesanan sampai.
                    </p>

                    {order && (
                        <details className="group mt-8 rounded-3xl border border-border-button-default bg-background-full">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold sm:p-5">
                                <span>Rincian pesanan</span>
                                <span className="flex items-center gap-3">
                                    <Badge variant="outline" className={order.status == "paid" ? "border-success text-success" : "border-warning text-warning"}>
                                        {order.status == "pending" ? "Menunggu pembayaran" : order.status == "paid" ? "Dibayar" : order.status}
                                    </Badge>
                                    <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">▾</span>
                                </span>
                            </summary>
                            <div className="space-y-4 border-t p-4 sm:p-5">
                                <ul className="space-y-3">
                                    {order.products.map((product) => (
                                        <li key={product.id} className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <img src={product.images[0].src} alt="" className="h-14 w-14 shrink-0 rounded-md border bg-secondary object-contain" />
                                                <p className="text-sm font-medium">{product.name} <span className="whitespace-nowrap text-muted-foreground">× {product.qty}</span></p>
                                            </div>
                                            <p className="shrink-0 text-sm font-semibold tabular-nums">{priceToIDR(product.price)}</p>
                                        </li>
                                    ))}
                                </ul>
                                <dl className="space-y-2 border-t pt-4 text-sm">
                                    {order.ongkir > 0 && (
                                        <div className="flex justify-between"><dt className="text-muted-foreground">Ongkos kirim</dt><dd className="tabular-nums">{priceToIDR(order.ongkir)}</dd></div>
                                    )}
                                    {order.voucherID && (
                                        <div className="flex justify-between text-success"><dt>Voucher</dt><dd className="font-semibold tabular-nums">- {priceToIDR(order?.voucherDiscount)}</dd></div>
                                    )}
                                    <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{priceToIDR(order.total)}</dd></div>
                                </dl>
                            </div>
                        </details>
                    )}

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Button asChild size="lg" className="sm:flex-1">
                            <a href="https://links.topsellbelanja.com/konfirmasi-pesanan-tsb" target="_blank" rel="noopener noreferrer">
                                Konfirmasi ke CS via WhatsApp
                            </a>
                        </Button>
                        <Button variant="outline" size="lg" className="sm:flex-1" onClick={() => window.location.replace("https://topsellbelanja.com")}>
                            Lanjut belanja
                        </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Ada kesalahan pada data pesanan atau ingin mengubahnya? Hubungi Customer Service lewat tombol di atas.
                    </p>
                </>
            )}
        </div>
    )
}

export default ManualPage