"use client";
import { Voucher } from "../interface/voucher";
import React from 'react'
import { useCart } from "./cart";
import { useShipping } from "./shipping";
import { useAddress } from "./address";
import { useAuthStore } from "@/lib/useAuthStore";
import { voucherAllowsFulfillment } from "../lib/voucher-display";
import { PICKUP_METHOD_TITLE } from "./pickup-stock";

interface VoucherContextType {
    vouchers: Voucher[],
    shippingVouchers: Voucher[],
    selectedVoucher: Voucher | null,
    selectedShippingVoucher: Voucher | null,
    voucherLoading: boolean,
    selectVoucher?: (voucher: Voucher) => void
    selectShippingVoucher?: (voucher: Voucher) => void
}

const VoucherContext = React.createContext<VoucherContextType | null>(null)

export const VoucherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [vouchers, setVouchers] = React.useState<Voucher[]>([])
    const [voucherLoading, setVoucherLoading] = React.useState<boolean>(false)
    const [shippingVouchers, setShippingVouchers] = React.useState<Voucher[]>([])
    const [selectedVoucher, setSelectedVoucher] = React.useState<Voucher | null>(null)
    const [selectedShippingVoucher, setSelectedShippingVoucher] = React.useState<Voucher | null>(null)
    const { cartQuery } = useCart()
    const { user, token } = useAuthStore()
    const { selectedShippingMethod, selectedShippingOption } = useShipping()
    const { selectedPostalCode, selectedPaymentMethod, selectedDestinationID } = useAddress()

    // Switching between "Ambil di Toko" and "Diantar ke Alamat" can invalidate a
    // voucher that is already selected. The refetch below sorts that out, but it
    // takes a moment, and until it lands the old selection is still on screen and
    // still submittable — pressing pay in that gap sends a voucher the server will
    // refuse. So a selection that no longer fits is dropped right away; the refetch
    // then re-applies whatever is auto-applicable for the new method.
    React.useEffect(() => {
        if (!selectedShippingMethod) return
        const isPickup = selectedShippingMethod.title === PICKUP_METHOD_TITLE
        setSelectedVoucher((current) =>
            current && !voucherAllowsFulfillment(current, isPickup) ? null : current
        )
        setSelectedShippingVoucher((current) =>
            current && !voucherAllowsFulfillment(current, isPickup) ? null : current
        )
    }, [selectedShippingMethod])

    React.useEffect(() => {
        if (cartQuery && cartQuery.split(",").length > 0 && selectedShippingMethod && selectedPaymentMethod && selectedDestinationID) {
            // Metode kirim/bayar/alamat bisa berganti beruntun (aturan otomatis
            // di modal alamat). Request lama dibatalkan supaya daftar voucher &
            // auto-apply dari respons basi tidak menimpa yang terbaru.
            const controller = new AbortController()
            fetchVouchers(undefined, controller.signal)
            fetchVouchers("shipping", controller.signal)
            return () => controller.abort()
        }
    }, [cartQuery, selectedShippingMethod, selectedPaymentMethod, selectedDestinationID, selectedShippingOption?.courierCode, selectedShippingOption?.courierServiceCode])

    const fetchVouchers = async (voucherType?: string, signal?: AbortSignal) => {
        let body: { 
            userID: string,
            data: { 
                cartID: string }[], 
                paymentMethodID: string, 
                shippingID: string, 
                destinationID: string, 
                postalCode: string,
                courierCode: string,
                courierServiceCode: string,
            } = { 
                userID: user?.id || "",
                data: [], 
                paymentMethodID: "", 
                shippingID: "", 
                destinationID: "", 
                postalCode: "",
                // The picked courier: a shipping voucher is capped at THIS
                // service's price, not the default one.
                courierCode: selectedShippingOption?.courierCode || "",
                courierServiceCode: selectedShippingOption?.courierServiceCode || "",
        }
        if (selectedShippingMethod) {
            body.shippingID = selectedShippingMethod.id
        }
        if (selectedDestinationID) {
            body.destinationID = selectedDestinationID
            body.postalCode = selectedPostalCode || ""
        }

        if (selectedPaymentMethod) {
            body.paymentMethodID = selectedPaymentMethod.id
        }

        cartQuery?.split(",").forEach((cartID) => {
            body.data.push({
                cartID: cartID
            })
        })
        try {
            setVoucherLoading(true)
            
            const url = voucherType ? `/backend/vouchers/all?voucher_type=${voucherType}` : '/backend/vouchers/all'
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(
                    body
                ),
                signal
            })
            const data = await res.json()
            if (data.data) {
                if (voucherType === "shipping") {
                    setShippingVouchers(data.data)
                    // Auto-apply shipping vouchers if isAutoApply is true, eligible, and payment method matches
                    const autoApplyVoucher = data.data.find((v: Voucher) => 
                        v.isEligible &&
                        v.isAutoApply && 
                        (!v.paymentMethodIDs || v.paymentMethodIDs.length === 0 || 
                         v.paymentMethodIDs.some(pm => pm.paymentMethodID === selectedPaymentMethod?.id))
                    )
                    if (autoApplyVoucher) {
                        setSelectedShippingVoucher(autoApplyVoucher)
                    } else {
                        setSelectedShippingVoucher(null)
                    }
                } else {
                    setVouchers(data.data)
                    // Auto-apply vouchers if isAutoApply is true, eligible, and payment method matches
                    const autoApplyVoucher = data.data.find((v: Voucher) => 
                        v.isEligible &&
                        v.isAutoApply && 
                        (!v.paymentMethodIDs || v.paymentMethodIDs.length === 0 || 
                         v.paymentMethodIDs.some(pm => pm.paymentMethodID === selectedPaymentMethod?.id))
                    )
                    if (autoApplyVoucher) {
                        setSelectedVoucher(autoApplyVoucher)
                    } else {
                        setSelectedVoucher(null)
                    }
                }
            } else {
                if (voucherType === "shipping") {
                    setShippingVouchers([])
                    setSelectedShippingVoucher(null)
                } else {
                    setVouchers([])
                    setSelectedVoucher(null)
                }
            }
        } catch (error) {
            if (signal?.aborted) return
            console.error(error)
        } finally {
            if (!signal?.aborted) setVoucherLoading(false)
        }
    }

    const selectVoucher = (voucher: Voucher) => {
        setSelectedVoucher(voucher)
    }

    const selectShippingVoucher = (voucher: Voucher) => {
        setSelectedShippingVoucher(voucher)
    }

    return (
        <VoucherContext.Provider value={{ vouchers, shippingVouchers, selectedVoucher, selectedShippingVoucher, selectVoucher, selectShippingVoucher, voucherLoading }}>
            {children}
        </VoucherContext.Provider>
    )
}

export const useVoucher = () => {
    const context = React.useContext(VoucherContext)
    if (!context) {
        throw new Error('useVoucher must be used within a VoucherProvider')
    }
    return context
}