"use client";
import PickVoucher from '../../components/pick-voucher'
import ProductDetail from '../../components/product_detail'
import ShippingAndPayment from '../../components/shipping-payment'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Separator } from '../../components/ui/separator'
import { useAddress } from '../../context/address';
import { useShipping } from '../../context/shipping'
import { useVoucher } from '../../context/voucher';
import { toast } from '../../hooks/use-toast';
import { CheckoutRequest } from '../../interface/checkout';
import { priceToIDR } from '../../lib/helper'
import { shippingOptionDuration, shippingOptionLabel } from '../../interface/shipping';
import { useAddressStore } from '../../lib/store';
import React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link';
import { useCart } from '@/context/cart';
import { useAuthStore } from '@/lib/useAuthStore';
import AuthModal from '@/components/auth-modal';

const StorePage = () => {
    const { totalQtyToCheckout, totalPriceToCheckout, checkoutLines, excludedItemIds, qtyOverrides } = useCart()
    const { shippingCost, selectedShippingMethod, selectedShippingOption, shippingOptionsLoading } = useShipping()
    const { selectedVoucher, selectedShippingVoucher } = useVoucher()
    const { addressState } = useAddressStore()
    const { selectedPaymentMethod, bankNumber, bankAccountName, selectedStore } = useAddress()
    const [voucherDiscount, setVoucherDiscount] = React.useState<number>(0)
    const [shippingVoucherDiscount, setShippingVoucherDiscount] = React.useState<number>(0)
    const [calculatedAdminFee, setCalculatedAdminFee] = React.useState<number>(0)
    const [grandTotal, setGrandTotal] = React.useState<number>(0)
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [isLoadingVoucher, setIsLoadingVoucher] = React.useState<boolean>(false)
    const { token, isAuthenticated } = useAuthStore();
    const [showAuthModal, setShowAuthModal] = React.useState<boolean>(false);

    React.useEffect(() => {
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
            const timer = setTimeout(() => {
                setShowAuthModal(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAuthenticated = React.useCallback(() => {
        setShowAuthModal(false);
    }, []);

    const router = useRouter()
    const { selectedSubdistrict, selectedPostalCode, selectedDestinationID } = useAddress()
    const countVoucherDiscount = async (signal: AbortSignal) => {
        try {
            setIsLoadingVoucher(true)
            if (selectedVoucher && totalPriceToCheckout) {
                let bodyPayload: { data: { id: string, qty?: number }[], shippingID: string, destinationID: string, postalCode: string, paymentMethodID: string, courierCode: string, courierServiceCode: string } = { data: [], shippingID: "", destinationID: "", postalCode: "", paymentMethodID: "", courierCode: selectedShippingOption?.courierCode || "", courierServiceCode: selectedShippingOption?.courierServiceCode || "" }
                if (selectedShippingMethod) {
                    bodyPayload.shippingID = selectedShippingMethod.id
                }
                if (selectedDestinationID) {
                    bodyPayload.destinationID = selectedDestinationID
                    bodyPayload.postalCode = selectedPostalCode || ""
                }
                if (selectedPaymentMethod) {
                    bodyPayload.paymentMethodID = selectedPaymentMethod.id
                }
                bodyPayload.data = checkoutLines.map((line) => (
                    qtyOverrides[line.id] ? { id: line.id, qty: line.qty } : { id: line.id }
                ))

                const res = await fetch(`/backend/vouchers/validate?voucherID=${selectedVoucher.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(bodyPayload),
                    signal
                })
                const data = await res.json()
                setVoucherDiscount(data.data)
            }

            if (selectedShippingVoucher && totalPriceToCheckout) {
                let bodyPayload: { data: { id: string, qty?: number }[], shippingID: string, destinationID: string, postalCode: string, paymentMethodID: string, courierCode: string, courierServiceCode: string } = { data: [], shippingID: "", destinationID: "", postalCode: "", paymentMethodID: "", courierCode: selectedShippingOption?.courierCode || "", courierServiceCode: selectedShippingOption?.courierServiceCode || "" }
                if (selectedShippingMethod) {
                    bodyPayload.shippingID = selectedShippingMethod.id
                }
                if (selectedDestinationID) {
                    bodyPayload.destinationID = selectedDestinationID
                    bodyPayload.postalCode = selectedPostalCode || ""
                }
                if (selectedPaymentMethod) {
                    bodyPayload.paymentMethodID = selectedPaymentMethod.id
                }
                bodyPayload.data = checkoutLines.map((line) => (
                    qtyOverrides[line.id] ? { id: line.id, qty: line.qty } : { id: line.id }
                ))

                const res = await fetch(`/backend/vouchers/validate?voucherID=${selectedShippingVoucher.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(bodyPayload),
                    signal
                })
                const data = await res.json()
                setShippingVoucherDiscount(data.data)
            }

            if (!selectedVoucher && !selectedShippingVoucher) {
                setVoucherDiscount(0)
                setShippingVoucherDiscount(0)
            }
        } catch (error) {
            if (signal.aborted) return
            toast({
                title: "Error",
                description: "Gagal menghitung diskon voucher",
                variant: "destructive"
            })
            setVoucherDiscount(0)
        } finally {
            if (!signal.aborted) setIsLoadingVoucher(false)
        }
    }

    const countGrandTotal = () => {
        // Calculate subtotal before admin fee (products + shipping - voucher discounts)
        const subtotalBeforeAdminFee = totalPriceToCheckout! + (shippingCost! || 0) - voucherDiscount - shippingVoucherDiscount;
        
        // Calculate admin fee based on type
        let adminFee = 0;
        if (selectedPaymentMethod) {
            if (selectedPaymentMethod.adminFeeType === 'percentage') {
                // For percentage, calculate from subtotal (products + shipping)
                const baseAmount = totalPriceToCheckout! + (shippingCost! || 0);
                adminFee = (selectedPaymentMethod.adminFee / 100) * baseAmount;
            } else {
                // For fixed, use the value directly
                adminFee = selectedPaymentMethod.adminFee;
            }
        }
        
        setCalculatedAdminFee(adminFee);
        setGrandTotal(subtotalBeforeAdminFee + adminFee);
    }

    const isPickup = selectedShippingMethod?.title === "Ambil di Toko"
    // A delivery needs a courier picked; without one there is no price to charge.
    const courierMissing = !!selectedShippingMethod && !isPickup && !selectedShippingOption

    const handleConfirmOrder = async () => {
        setIsLoading(true)
        const checkoutRequest: CheckoutRequest = {
            address: addressState?.address + ", " + addressState?.subdistrict + ", " + addressState?.city + ", " + addressState?.province + ", " + addressState?.postal_code || "",
            city: addressState?.city || "",
            postalCode: addressState?.postal_code || "",
            // Rows at the quantity being bought; a lowered quantity travels
            // with the row, an excluded row is named so the cart is cleared of
            // it once the order is placed.
            cartItems: checkoutLines.map((line) => (
                qtyOverrides[line.id] ? { id: line.id, qty: line.qty } : { id: line.id }
            )),
            excludedCartItems: excludedItemIds.map((id) => ({ id })),
            shippingID: selectedShippingMethod?.id || "",
            // The courier service picked for a delivery; the server re-quotes
            // it and books exactly this service after payment.
            courierCode: isPickup ? "" : (selectedShippingOption?.courierCode || ""),
            courierServiceCode: isPickup ? "" : (selectedShippingOption?.courierServiceCode || ""),
            courierServiceName: isPickup ? "" : shippingOptionLabel(selectedShippingOption),
            name: addressState?.name || "",
            email: addressState?.email || "",
            phone: addressState?.phone || "",
            subdistrictID: addressState?.subdistrict || "",
            destinationID: addressState?.destinationID || "",
            voucherID: selectedVoucher?.id || "",
            shippingVoucherID: selectedShippingVoucher?.id || "",
            paymentMethodID: selectedPaymentMethod?.id || "",
            bankAccountName: bankAccountName || "",
            bankAccountNumber: bankNumber || "",
            areaID: selectedShippingMethod?.title == "Ambil di Toko" ? selectedStore?.id : null
        }

        try {
            const res = await fetch(`/backend/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(checkoutRequest)
            })

            if (res.status != 200) {
                // Said out loud: this used to fall through and leave the button
                // doing nothing, even when the order had in fact been created
                // and only the step after it (payment page, bookkeeping) failed.
                let message = "Pesanan gagal diproses. Silakan cek menu Pesanan sebelum mencoba lagi."
                try {
                    const body = await res.json()
                    message = body?.message || body?.error || message
                } catch { }
                toast({ title: "Gagal membuat pesanan", description: message, variant: "destructive" })
                return
            }

            if (res.status == 200) {
                const data = await res.json()
                if (!data?.redirectURL) {
                    // The order exists but there is no payment page to send the
                    // customer to; the order page can still offer one.
                    toast({
                        title: "Pesanan dibuat",
                        description: "Halaman pembayaran belum tersedia. Lanjutkan pembayaran dari menu Pesanan.",
                    })
                    router.push("/order")
                    return
                }
                if (selectedPaymentMethod?.key == "manual") {
                    router.push(data.redirectURL)
                }

                if (selectedPaymentMethod?.key == "bca") {
                    window.location.assign(
                        data.redirectURL + "#/bank-transfer/bca-va"
                    )
                } else if (selectedPaymentMethod?.key == "bni") {
                    window.location.assign(
                        data.redirectURL + "#/bank-transfer/bni-va"
                    )
                } else if (selectedPaymentMethod?.key == "mandiri") {
                    window.location.assign(
                        data.redirectURL + "#/bank-transfer/mandiri-bill"
                    )
                } else if (selectedPaymentMethod?.key == "bri") {
                    window.location.assign(
                        data.redirectURL + "#/bank-transfer/bri-va"
                    )
                } else if (selectedPaymentMethod?.key == "permata") {
                    window.location.assign(
                        data.redirectURL + "#/bank-transfer/permata-va"
                    )
                } else if (selectedPaymentMethod?.key == "cc") {
                    router.push(data.redirectURL)
                } else if (selectedPaymentMethod?.key == "shopeepay") {
                    window.location.assign(
                        data.redirectURL
                    )
                } else if (selectedPaymentMethod?.key == "qris") {
                    window.location.assign(
                        data.redirectURL
                    )
                } else {
                    window.location.assign(
                        data.redirectURL
                    )
                }
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to process order",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const isShippingNotAmbilDiToko = shippingCost && selectedShippingMethod?.title != "Ambil di Toko"

    React.useEffect(() => {
        // Batalkan validasi lama: diskon dari respons basi tidak boleh menimpa yang baru
        const controller = new AbortController()
        countVoucherDiscount(controller.signal)
        return () => controller.abort()
    }, [selectedVoucher, selectedShippingVoucher, selectedShippingMethod, selectedSubdistrict, selectedShippingOption?.courierCode, selectedShippingOption?.courierServiceCode])

    React.useEffect(() => {
        countGrandTotal()
    }, [totalPriceToCheckout, shippingCost, voucherDiscount, shippingVoucherDiscount, selectedPaymentMethod])

    return (
        <div className='container mx-auto max-w-7xl px-6 mb-12'>
            <AuthModal open={showAuthModal} onAuthenticated={handleAuthenticated} onClose={() => setShowAuthModal(false)} />
            <div className='grid grid-cols-1 gap-12 md:grid-cols-2'>
                <div className='space-y-6'>
                    <ProductDetail />
                    <Separator />
                    <ShippingAndPayment />
                </div>
                <div className='space-y-6'>
                    <Card className='mt-12'>
                        {/*<CardHeader>
                            <CardTitle></CardTitle>
                        </CardHeader>*/}
                        <CardContent className='pt-4 space-y-6'>
                            <PickVoucher />
                            <Separator />
                            <div className='space-y-2'>
                                <h5 className='text-lg font-semibold'>Ringkasan Belanja</h5>
                                <h5 className='font-semibold'>Total Belanja</h5>
                                <div className='flex justify-between text-gray-500'>
                                    <span>Total Harga ({totalQtyToCheckout}) barang</span>
                                    <span>{priceToIDR(totalPriceToCheckout || 0)}</span>
                                </div>
                                {
                                    isShippingNotAmbilDiToko ? (
                                        <div className='flex justify-between text-gray-500'>
                                            <span>
                                                Ongkos Kirim
                                                {selectedShippingOption && (
                                                    <span className='block text-xs text-gray-400'>
                                                        {shippingOptionLabel(selectedShippingOption)}
                                                        {shippingOptionDuration(selectedShippingOption) ? ` · ${shippingOptionDuration(selectedShippingOption)}` : ''}
                                                    </span>
                                                )}
                                            </span>
                                            <span>{priceToIDR(shippingCost || 0)}</span>
                                        </div>
                                    ) : (
                                        <div className='flex justify-between text-gray-500'>
                                            {/* <span>Ongkos Kirim</span>
                                            <span>Gratis</span> */}
                                        </div>
                                    )
                                }
                                {
                                    selectedPaymentMethod && selectedPaymentMethod.adminFee > 0 && (
                                        <div className='flex justify-between text-gray-500'>
                                            <span>
                                                Biaya Admin
                                            </span>
                                            <span>{priceToIDR(calculatedAdminFee || 0)}</span>
                                        </div>
                                    )
                                }
                                {
                                    selectedVoucher && (
                                        <div className='flex justify-between text-red-500'>
                                            <span>Diskon Voucher</span>
                                            <span>{
                                                isLoadingVoucher ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        <span>Loading...</span>
                                                    </div>
                                                ) : (
                                                    "-" + priceToIDR(voucherDiscount || 0)
                                                )
                                            }</span>
                                        </div>
                                    )
                                }
                                {
                                    selectedShippingVoucher && (
                                        <div className='flex justify-between text-blue-500'>
                                            <span>Diskon Ongkir</span>
                                            <span>{isLoadingVoucher ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                    <span>Loading...</span>
                                                </div>
                                            ) : (
                                                "-" + priceToIDR(shippingVoucherDiscount || 0)
                                            )}</span>
                                        </div>
                                    )
                                }
                                <div className='flex justify-between font-black'>
                                    <span>Total</span>
                                    <span>{priceToIDR(grandTotal || 0)}</span>
                                </div>
                                <Separator />
                                <Button
                                    className='w-full text-xl font-bold h-12'
                                    variant="destructive"
                                    onClick={handleConfirmOrder}
                                    disabled={!addressState || !addressState.destinationID || !selectedPaymentMethod || !selectedShippingMethod || courierMissing || shippingOptionsLoading || isLoading}
                                >
                                    {isLoading ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Processing...</span>
                                        </div>
                                    ) : (
                                        <span>Konfirmasi Pesanan</span>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className='my-12 w-full flex md:hidden justify-center'>
                <Link href="https://links.topsellbelanja.com/konfirmasi-pesanan-tsb" target='_blank'>
                    <Button
                        variant="default"
                        className='bg-green-500 hover:bg-green-600 font-bold text-lg px-4 py-5'
                    >
                        <img src="/icons/whatsapp.svg" alt="Home" className="h-6" />
                        Bantuan Cara Order
                    </Button>
                </Link>
            </div>
        </div>
    )
}

export default StorePage