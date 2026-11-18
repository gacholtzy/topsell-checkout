"use client"
import { VisuallyHidden } from "../../../components/global/VisuallyHidden";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Separator } from "../../../components/ui/separator";
import { toast } from "../../../hooks/use-toast";
import { Order, OrderProduct } from "../../../interface/order";
import { priceToIDR } from "../../../lib/helper";
import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";

const ThankYouPage = () => {
    const { inv } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [order, setOrder] = useState<Order | null>(null);
    const [subtotal, setSubtotal] = useState<number>(0);

    const fetchOrder = async () => {
        try {
            setIsLoading(true)
            const res = await fetch(`/backend/orders?invoice=${inv}`)
            const data = await res.json()
            console.log(data)
            setOrder(data.data)
            setSubtotal(data.data.products.reduce((acc: number, product: OrderProduct) => acc + product.price * product.qty, 0))
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

    useEffect(() => {
        fetchOrder()
    }, [inv]);
    const isPickup = order?.shipping.title == "Ambil di Toko"

    return (
        <div className='mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 sm:pt-10'>
            {isLoading ? (
                <div className="flex justify-center py-16" role="status" aria-label="Memuat pesanan">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                </div>
            ) : !order ? (
                <div className="rounded-3xl border border-border-button-default bg-background-full p-8 text-center">
                    <h1 className="text-xl font-bold">Pesanan tidak ditemukan</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Periksa nomor invoice, atau buka menu Pesanan untuk melihat riwayat Anda.</p>
                    <Button asChild className="mt-5"><Link href="/order">Lihat pesanan saya</Link></Button>
                </div>
            ) : (
                <>
                    <p className="text-sm font-semibold text-success">Pesanan diterima</p>
                    <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Terima kasih, {order.name}</h1>
                    <p className="mt-2 text-muted-foreground">
                        Pesanan <span className="font-semibold text-foreground">{order.invoice}</span> sudah kami terima. Rinciannya ada di bawah.
                    </p>

                    <div className="mt-6 divide-y rounded-3xl border border-border-button-default bg-background-full">
                        <section className="p-4 sm:p-6" aria-labelledby="ty-items">
                            <h2 id="ty-items" className="mb-3 text-base font-bold">Barang</h2>
                            <ul className="space-y-4">
                                {order.products.map((product) => (
                                    <li key={product.id} className="flex gap-3">
                                        <img src={product.images[0].src} alt="" className="h-16 w-16 shrink-0 rounded-md border bg-secondary object-contain" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold sm:text-base">{product.name} <span className="whitespace-nowrap font-medium text-muted-foreground">× {product.qty}</span></p>
                                            {product.variant && <p className="text-sm text-muted-foreground">{product.variant}</p>}
                                            <p className="mt-1 text-sm font-bold tabular-nums">{priceToIDR(product.price * product.qty)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="p-4 sm:p-6" aria-labelledby="ty-ship">
                            <h2 id="ty-ship" className="mb-3 text-base font-bold">Pengiriman dan pembayaran</h2>
                            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
                                <dt className="text-muted-foreground">Pembayaran</dt>
                                <dd className="font-medium">{order.paymentMethod.name}</dd>
                                <dt className="text-muted-foreground">Pengiriman</dt>
                                <dd className="font-medium">{order.shipping.title}{isPickup ? ` · ${order.area?.name} · ${order.area?.storeArea?.name}` : ""}</dd>
                                <dt className="text-muted-foreground">{isPickup ? "Lokasi toko" : "Alamat tujuan"}</dt>
                                <dd className="font-medium">{isPickup ? order.area?.address : order.address}</dd>
                                <dt className="text-muted-foreground">Kontak</dt>
                                <dd className="font-medium">{order.phone}<br />{order.email}</dd>
                            </dl>
                        </section>

                        <section className="p-4 sm:p-6" aria-labelledby="ty-sum">
                            <h2 id="ty-sum" className="mb-3 text-base font-bold">Ringkasan</h2>
                            <dl className="space-y-2.5 text-sm">
                                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Harga ({order.products.length} barang)</dt><dd className="tabular-nums">{priceToIDR(subtotal || 0)}</dd></div>
                                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Ongkos kirim</dt><dd className="tabular-nums">{priceToIDR(order.ongkir || 0)}</dd></div>
                                {!!order.adminFee && order.adminFee > 0 && (
                                    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Biaya admin</dt><dd className="tabular-nums">{priceToIDR(order.adminFee)}</dd></div>
                                )}
                                {order.voucherID && (
                                    <div className="flex justify-between gap-4 text-success"><dt>Potongan harga</dt><dd className="font-semibold tabular-nums">- {priceToIDR(order.voucherDiscount || 0)}</dd></div>
                                )}
                            </dl>
                            <div className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
                                <span className="font-bold">Total</span>
                                <span className="text-xl font-extrabold tabular-nums">{priceToIDR(order.total || 0)}</span>
                            </div>
                        </section>
                    </div>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <Button asChild size="lg" className="sm:flex-1">
                            <Link href={`/tracking/${order.invoice}`}>Lacak pesanan</Link>
                        </Button>
                        <Button variant="outline" size="lg" className="sm:flex-1" onClick={() => window.location.replace("https://topsellbelanja.com")}>
                            Lanjut belanja
                        </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Ada kesalahan data atau ingin mengubah pesanan?{" "}
                        <a href="https://links.topsellbelanja.com/konfirmasi-pesanan-tsb" target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
                            Hubungi Customer Service
                        </a>.
                    </p>
                </>
            )}
        </div>
    )
}

export default ThankYouPage;
