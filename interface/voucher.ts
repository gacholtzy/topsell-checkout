export interface Voucher {
    id: string
    name: string
    type: string
    description: string
    minTransaction: number
    discount: number
    maxDiscount: number
    qty: number
    startDate: string
    endDate: string
    /** When the voucher stops working for the current user; differs from endDate for new-user vouchers. */
    effectiveEndDate?: string
    usedQty: number
    productIDs: ProductId[]
    isAutoApply?: boolean
    isCancellable?: boolean
    paymentMethodIDs?: PaymentMethodID[]
    /** Limits the voucher to delivery or pickup orders; absent or "all" means both. */
    fulfillmentType?: "all" | "delivery" | "pickup"
    /** Variations a product on this voucher is narrowed to. A product with none accepts every variation. */
    variationIDs?: VariationID[]
    isEligible: boolean
    ineligibleReason?: string
}

export interface VariationID {
    id: string
    productID: string
    variationID: string
    voucherID: string
}

export interface PaymentMethodID {
    id: string
    paymentMethodID: string
    voucherID: string
}

export interface ProductId {
    productId: string[]
    voucherId: string
}