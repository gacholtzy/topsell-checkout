"use client";
import PickVoucher from '../../components/pick-voucher'
import ProductDetail from '../../components/product_detail'
import ShippingOption from '../../components/shipping-option'
import PaymentOption from '../../components/payment-option'
import { CheckoutSection } from '../../components/checkout/section'
import { Button } from '../../components/ui/button'
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

    // What still stands between the customer and a placed order, in the order
    // they would fix it. Shown next to the button so a disabled button is never
    // a mystery.
    const blockedReason = !selectedShippingMethod
        ? "Pilih metode pengiriman"
        : (!addressState || !addressState.destinationID)
            ? "Lengkapi data pembeli dan alamat"
            : courierMissing
                ? "Pilih kurir pengiriman"
                : shippingOptionsLoading
                    ? "Menghitung ongkos kirim…"
                    : !selectedPaymentMethod
                        ? "Pilih metode pembayaran"
                        : null
    const canConfirm = blockedReason === null && !isLoading

    const showShippingLine = !!isShippingNotAmbilDiToko
    const confirmLabel = isLoading ? "Memproses…" : "Konfirmasi Pesanan"

    const confirmButton = () => (
        <Button size="lg" className="w-full font-bold" onClick={handleConfirmOrder} disabled={!canConfirm}>
            {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
            {confirmLabel}
        </Button>
    )

    const loadingRow = (
        <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            Menghitung…
        </span>
    )

    return (
        <div className='mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-12'>
            <AuthModal open={showAuthModal} onAuthenticated={handleAuthenticated} onClose={() => setShowAuthModal(false)} />

            <nav aria-label="Langkah belanja" className='mb-5 flex items-center gap-2 text-sm text-muted-foreground'>
                <Link href="/cart" className='underline-offset-4 hover:text-foreground hover:underline'>Keranjang</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="step" className='font-semibold text-foreground'>Checkout</span>
                <span aria-hidden="true">/</span>
                <span>Pembayaran</span>
            </nav>
            <h1 className='mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl'>Checkout</h1>

            <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10'>
                <div className='divide-y rounded-lg border bg-card'>
                    <CheckoutSection step={1} title="Barang yang dibeli" done={totalQtyToCheckout > 0}>
                        <ProductDetail />
                    </CheckoutSection>
                    <CheckoutSection step={2} title="Pengiriman" done={!!selectedShippingMethod && !!addressState?.destinationID && !courierMissing}>
                        <ShippingOption />
                    </CheckoutSection>
                    <CheckoutSection step={3} title="Pembayaran" done={!!selectedPaymentMethod}>
                        <PaymentOption />
                    </CheckoutSection>
                </div>

                <aside aria-label="Ringkasan pesanan" className='rounded-lg border bg-card lg:sticky lg:top-20'>
                    <div className='p-4 sm:p-6'>
                        <PickVoucher />
                    </div>
                    <div className='space-y-3 border-t p-4 text-sm sm:p-6'>
                        <h2 className='text-base font-bold'>Ringkasan</h2>
                        <dl className='space-y-2.5'>
                            <div className='flex justify-between gap-4'>
                                <dt className='text-muted-foreground'>Harga ({totalQtyToCheckout} barang)</dt>
                                <dd className='font-medium tabular-nums'>{priceToIDR(totalPriceToCheckout || 0)}</dd>
                            </div>
                            {showShippingLine && (
                                <div className='flex justify-between gap-4'>
                                    <dt className='text-muted-foreground'>
                                        Ongkos kirim
                                        {selectedShippingOption && (
                                            <span className='block text-xs'>
                                                {shippingOptionLabel(selectedShippingOption)}
                                                {shippingOptionDuration(selectedShippingOption) ? ` · ${shippingOptionDuration(selectedShippingOption)}` : ''}
                                            </span>
                                        )}
                                    </dt>
                                    <dd className='font-medium tabular-nums'>{priceToIDR(shippingCost || 0)}</dd>
                                </div>
                            )}
                            {selectedPaymentMethod && selectedPaymentMethod.adminFee > 0 && (
                                <div className='flex justify-between gap-4'>
                                    <dt className='text-muted-foreground'>Biaya admin</dt>
                                    <dd className='font-medium tabular-nums'>{priceToIDR(calculatedAdminFee || 0)}</dd>
                                </div>
                            )}
                            {selectedVoucher && (
                                <div className='flex justify-between gap-4 text-success'>
                                    <dt>Diskon voucher</dt>
                                    <dd className='font-semibold tabular-nums'>{isLoadingVoucher ? loadingRow : "-" + priceToIDR(voucherDiscount || 0)}</dd>
                                </div>
                            )}
                            {selectedShippingVoucher && (
                                <div className='flex justify-between gap-4 text-success'>
                                    <dt>Diskon ongkir</dt>
                                    <dd className='font-semibold tabular-nums'>{isLoadingVoucher ? loadingRow : "-" + priceToIDR(shippingVoucherDiscount || 0)}</dd>
                                </div>
                            )}
                        </dl>
                        <div className='flex items-baseline justify-between gap-4 border-t pt-4'>
                            <span className='text-base font-bold'>Total bayar</span>
                            <span className='text-xl font-extrabold tabular-nums'>{priceToIDR(grandTotal || 0)}</span>
                        </div>
                        <div className='hidden space-y-2 pt-1 lg:block'>
                            {confirmButton()}
                            {blockedReason && <p className='text-center text-sm text-muted-foreground' role='status'>{blockedReason}</p>}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Phone: the total and the button stay in reach while the form scrolls. */}
            <div className='fixed inset-x-0 bottom-0 z-30 border-t bg-card px-4 pb-safe pt-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.2)] lg:hidden'>
                <div className='mx-auto flex max-w-6xl flex-col gap-2 pb-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-4'>
                    <div className='min-w-0 flex-1'>
                        <p className='text-xs text-muted-foreground'>Total bayar</p>
                        <p className='truncate text-lg font-extrabold tabular-nums'>{priceToIDR(grandTotal || 0)}</p>
                        {blockedReason && <p className='text-xs text-muted-foreground min-[400px]:truncate' role='status'>{blockedReason}</p>}
                    </div>
                    <div className='min-[400px]:shrink-0'>{confirmButton()}</div>
                </div>
            </div>
        </div>
    )
}

export default StorePage
