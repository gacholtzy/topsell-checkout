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
            className: "bg-green-500 text-white"
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

    return (
        <div className='container mx-auto max-w-7xl px-6 mb-12'>
            {isLoading ? (
                <div className="flex justify-center my-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            ) : order?.status === "expired" ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 max-w-md w-full text-center">
                        <div className="flex justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-red-600 mb-4">Pesanan Kedaluwarsa</h1>
                        <div className="space-y-4">
                            <p className="text-lg text-gray-700">Pesanan dengan invoice <span className="font-semibold">{order.invoice}</span> telah kedaluwarsa karena melewati batas waktu pembayaran.</p>
                            <div className="bg-red-100 p-4 rounded-md">
                                <p className="text-red-800 font-medium">Silakan buat pesanan baru untuk melanjutkan belanja.</p>
                            </div>
                            <div className="mt-6 pt-4 border-t border-red-200">
                                <p className="text-lg">Anda akan dialihkan ke halaman utama dalam</p>
                                <div className="flex justify-center mt-2">
                                    <div className="bg-red-500 text-white text-2xl font-bold rounded-lg p-3 min-w-[60px]">
                                        {redirectCountdown}
                                    </div>
                                    <p className="self-center ml-2 text-lg">detik</p>
                                </div>
                            </div>
                        </div>
                        <Button 
                            className="mt-6 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                            onClick={() => window.location.replace("https://topsellbelanja.com")}
                        >
                            Kembali ke Beranda
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <h1 className='text-2xl md:text-3xl font-bold text-center my-3'>Selesaikan pembayaran dalam</h1>

                    {timeLeft ? (
                        <div className="flex justify-center gap-4 my-8">
                            <div className="flex flex-col items-center">
                                <div className="bg-primary text-white text-2xl md:text-4xl font-bold rounded-lg p-4 min-w-[80px] text-center">
                                    {String(timeLeft.hours).padStart(2, '0')}
                                </div>
                                <span className="text-sm mt-2">Jam</span>
                            </div>
                            <div className="text-2xl md:text-4xl font-bold self-center">:</div>
                            <div className="flex flex-col items-center">
                                <div className="bg-primary text-white text-2xl md:text-4xl font-bold rounded-lg p-4 min-w-[80px] text-center">
                                    {String(timeLeft.minutes).padStart(2, '0')}
                                </div>
                                <span className="text-sm mt-2">Menit</span>
                            </div>
                            <div className="text-2xl md:text-4xl font-bold self-center">:</div>
                            <div className="flex flex-col items-center">
                                <div className="bg-primary text-white text-2xl md:text-4xl font-bold rounded-lg p-4 min-w-[80px] text-center">
                                    {String(timeLeft.seconds).padStart(2, '0')}
                                </div>
                                <span className="text-sm mt-2">Detik</span>
                            </div>
                        </div>
                    ) : null}
                    <h2 className="text-xl font-semibold mb-4 text-gray-500 text-center">Batas akhir pembayaran</h2>
                    <p className="text-lg text-center font-bold">{deadline}</p>
                    {order && (
                        <div className="mt-8 p-6 border rounded-lg shadow-sm flex flex-col gap-4 w-full">
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-2">
                                    <h2 className="text-xl font-semibold">Detail Pesanan</h2>
                                    <p className="font-bold"><span className="font-medium">Invoice:</span> {order.invoice}</p>
                                </div>
                                <Badge variant="outline" className={`${order.status == "pending" ? "bg-yellow-500" : order.status == "paid" ? "bg-green-500" : "bg-red-500"} text-white`}>{order.status.toUpperCase()}</Badge>
                            </div>
                            <Separator />
                            {
                                order.products.map((product) => (
                                    <div key={product.id} className="flex items-center justify-between px-4">
                                        <div className="flex items-center gap-2">
                                            <img src={product.images[0].src} alt={product.name} width={80} height={80} />
                                            <p className="font-bold">{product.name} x {product.qty}</p>
                                        </div>
                                        <p className="font-bold">{priceToIDR(product.price)}</p>
                                    </div>
                                ))
                            }
                            <Separator />
                            {
                                order.ongkir > 0 && (
                                    <div className="flex items-center justify-between px-4">
                                        <p className="font-bold">Ongkos Kirim:</p>
                                        <p className="font-bold">{priceToIDR(order.ongkir)}</p>
                                    </div>
                                )
                            }
                            {
                                order.voucherID && (
                                    <div className="flex items-center justify-between px-4">
                                        <p className="font-bold">Voucher:</p>
                                        <p className="font-bold text-red-500">- {priceToIDR(order?.voucherDiscount)}</p>
                                    </div>
                                )
                            }
                            <Separator />
                            <div className="flex items-center justify-between px-4">
                                <p className="font-bold">Total Pembayaran:</p>
                                <p className="font-bold">{priceToIDR(order.total)}</p>
                            </div>
                        </div>
                    )}
                    <Separator />
                    <div className="mt-8 p-6 border rounded-lg shadow-sm flex flex-col gap-4 w-full">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-xl font-semibold">Transfer Bank</h2>
                            <h3 className="text-gray-500">Pilih salah satu nomor rekening bank di bawah ini</h3>
                        </div>
                        <Separator />
                        {order && (() => {
                            // Check if any product has category "elektronik"
                            const hasElektronik = order.products.some(product => 
                                product.categories?.some(category => 
                                    category.name.toLowerCase() == "elektronik".toLowerCase()
                                )
                            );
                            
                            // Check if any product has category "sepeda listrik"
                            const hasSepedaListrik = order.products.some(product => 
                                product.categories?.some(category => 
                                    category.name.toLowerCase() == "sepeda listrik".toLowerCase()
                                )
                            );
                            
                            // Display appropriate bank accounts based on categories
                            if (hasElektronik) {
                                return (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-lg">BCA PT. Topsel Raharja Indonesia</p>
                                                <p className="font-semibold text-gray-500">6105777721</p>
                                            </div>
                                            <Button variant="link" className="text-red-500 font-bold" onClick={() => copyToClipboard("6105777721")}>
                                                <CopyIcon className="w-4 h-4" /> Salin
                                            </Button>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-lg">Mandiri PT. Topsel Raharja Indonesia</p>
                                                <p className="font-semibold text-gray-500">1420099191990</p>
                                            </div>
                                            <Button variant="link" className="text-red-500 font-bold" onClick={() => copyToClipboard("1420099191990")}>
                                                <CopyIcon className="w-4 h-4" /> Salin
                                            </Button>
                                        </div>
                                    </>
                                );
                            } else if (hasSepedaListrik) {
                                return (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-lg">BCA PT Tri Kasih Karunia</p>
                                                <p className="font-semibold text-gray-500">6105863636</p>
                                            </div>
                                            <Button variant="link" className="text-red-500 font-bold" onClick={() => copyToClipboard("6105863636")}>
                                                <CopyIcon className="w-4 h-4" /> Salin
                                            </Button>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-lg">Mandiri PT Tri Kasih Karunia</p>
                                                <p className="font-semibold text-gray-500">1420500068878</p>
                                            </div>
                                            <Button variant="link" className="text-red-500 font-bold" onClick={() => copyToClipboard("1420500068878")}>
                                                <CopyIcon className="w-4 h-4" /> Salin
                                            </Button>
                                        </div>
                                    </>
                                );
                            } else {
                                return (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-lg">BCA PT. Topsel Raharja Indonesia</p>
                                                <p className="font-semibold text-gray-500">6105777721</p>
                                            </div>
                                            <Button variant="link" className="text-red-500 font-bold" onClick={() => copyToClipboard("6105777721")}>
                                                <CopyIcon className="w-4 h-4" /> Salin
                                            </Button>
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col gap-2">
                                                <p className="font-bold text-lg">Mandiri PT. Topsel Raharja Indonesia</p>
                                                <p className="font-semibold text-gray-500">1420099191990</p>
                                            </div>
                                            <Button variant="link" className="text-red-500" onClick={() => copyToClipboard("1420099191990")}>
                                                <CopyIcon className="w-4 h-4" /> Salin
                                            </Button>
                                        </div>
                                    </>
                                );
                            }
                        })()}
                        <Separator />
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col gap-2">
                                <p className="font-bold text-lg">Total Pembayaran:</p>
                                <p className="font-bold">{priceToIDR(order?.total || 0)}</p>
                            </div>
                            <Button variant="link" className="text-red-500 font-bold" onClick={() => copyToClipboard(order?.total.toString() || "")}>
                                <CopyIcon className="w-4 h-4" /> Salin
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-center my-6">
                        <Button className="my-4 text-2xl h-16 font-bold" variant="destructive" size="lg" onClick={() => window.location.replace("https://topsellbelanja.com")}>
                            Lanjutkan Belanja
                        </Button>
                    </div>
                    <Separator />
                    <div className="flex justify-center my-6 max-w-xl mx-auto">
                        <p className="text-gray-500 text-center">
                            Apabila terjadi kesalahan pada detail di atas atau ingin melakukan
                            perubahan data pesanan*. Anda dapat menghubungi Customer Service
                            Viranda dengan klik tombol di bawah ini.
                        </p>
                    </div>
                    <div className="flex justify-center my-6">
                        <Link href="https://links.topsellbelanja.com/konfirmasi-pesanan-tsb" className="flex justify-center my-6 bg-green-500 p-4 rounded-lg h-16 items-center gap-2" target="_blank">
                            <img src="/icons/whatsapp.svg" alt="WhatsApp" className="w-8 h-8" /> <span className="text-white font-bold">CS Viranda</span>
                        </Link>
                    </div>
                </>
            )}
        </div>
    )
}

export default ManualPage