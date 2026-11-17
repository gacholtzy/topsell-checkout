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
    return (
        <div className='container mx-auto max-w-7xl px-6 mb-12'>
            {
                isLoading ? (
                    <div className="flex justify-center my-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div>
                        <h1 className='text-2xl md:text-3xl font-bold text-center my-3'>Terima Kasih Telah Belanja</h1>
                        <p className='text-center my-3 text-gray-500'>Halo kak {order?.name}, pesanan kamu telah kami terima dengan detail:</p>
                        <h2 className='text-lg font-bold my-3'>Produk yang dibeli:</h2>
                        <Card>
                            <CardHeader>
                                <CardTitle className="w-full text-right">Pesanan {order?.invoice}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4">
                                    {order?.products.map((product) => (
                                        <div key={product.id} className="flex items-start justify-between w-full">
                                            <div className="flex items-start gap-4">
                                                <img src={product.images[0].src} alt={product.name} width={100} height={100} />
                                                <div className="flex flex-col gap-2">
                                                    <h3 className="text-lg font-bold">{product.name} x {product.qty}</h3>
                                                    {
                                                        product.variant && (
                                                            <p className="text-sm text-gray-500">{product.variant}</p>
                                                        )
                                                    }
                                                    {
                                                        product.regularPrice != product.price || product.regularPrice == 0 ? (
                                                            <p className="text-sm font-bold text-red-500">{priceToIDR(product.regularPrice != product.price || product.regularPrice == 0 ? product.price : product.regularPrice)}</p>
                                                        ) : (
                                                            <p className="text-sm font-bold text-red-500">{priceToIDR(product.regularPrice)}</p>
                                                        )
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        <h2 className="text-lg font-bold my-3">Pembayaran dan Pengiriman</h2>
                        <Card>
                            <VisuallyHidden>
                                <CardHeader>
                                    <CardTitle>Metode Pembayaran</CardTitle>
                                </CardHeader>
                            </VisuallyHidden>
                            <CardContent className="pt-6">
                                <h3 className="text-lg font-bold">Metode Pembayaran</h3>
                                <p className="text-black">{order?.paymentMethod.name}</p>
                                <Separator className="my-6" />
                                <h3 className="text-lg font-bold">Metode Pengiriman</h3>
                                <p className="text-black">{order?.shipping.title} {order?.shipping.title == "Ambil di Toko" ? ` - ${order?.area?.name} - ${order?.area?.storeArea?.name}` : ""}</p>
                            </CardContent>
                        </Card>
                        <h2 className="text-lg font-bold my-3">Alamat Pengiriman</h2>
                        <Card>
                            <CardHeader>
                                <CardTitle>({order?.phone})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-black">{
                                    order?.shipping.title == "Ambil di Toko" ? order?.area?.address : order?.address
                                }</p>
                                <p className="text-black">{order?.email}</p>
                            </CardContent>
                        </Card>
                        <h2 className="text-lg font-bold my-3">Ringkasan Belanja</h2>
                        <Card>
                            <VisuallyHidden>
                                <CardHeader>
                                    <CardTitle>Ringkasan Belanja</CardTitle>
                                </CardHeader>
                            </VisuallyHidden>
                            <CardContent className="py-6">
                                <div className="flex w-full justify-between">
                                    <p>Total Harga ({order?.products.length} Barang)</p>
                                    <p>{priceToIDR(subtotal || 0)}</p>
                                </div>
                                <div className="flex w-full justify-between">
                                    <p>Ongkos Kirim</p>
                                    <p>{priceToIDR(order?.ongkir || 0)}</p>
                                </div>
                                {
                                    order?.adminFee && order?.adminFee > 0 && (
                                        <div className="flex w-full justify-between">
                                            <p>Biaya Admin</p>
                                            <p>{priceToIDR(order?.adminFee || 0)}</p>
                                        </div>
                                    )
                                }
                                {
                                    order?.voucherID && (
                                        <div className="flex w-full justify-between">
                                            <p>Potongan Harga</p>
                                            <p className="font-bold text-red-500">- {priceToIDR(order?.voucherDiscount || 0)}</p>
                                        </div>
                                    )
                                }
                                <Separator className="my-6" />
                                <div className="flex w-full justify-between">
                                    <p className="font-bold">Total Belanja</p>
                                    <p className="font-bold">{priceToIDR(order?.total || 0)}</p>
                                </div>
                            </CardContent>
                        </Card>
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
                    </div>
                )
            }
        </div>
    )
}

export default ThankYouPage;