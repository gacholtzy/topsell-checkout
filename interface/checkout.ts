export interface CheckoutRequest {
    address: string;
    areaID?: string | null;
    bankAccountName?: string;
    bankAccountNumber?: string;
    city: string;
    email: string;
    name: string;
    paymentMethodID?: string;
    phone?: string;
    postalCode?: string;
    cartItems: CartItemRequestToCheckout[];
    /** Rows left out of a pickup order; cleared from the cart once it is placed. */
    excludedCartItems?: CartItemRequestToCheckout[];
    shippingID?: string;
    /** Courier service picked from the options list (Biteship codes). */
    courierCode?: string;
    courierServiceCode?: string;
    courierServiceName?: string;
    subdistrictID?: string;
    /** Biteship area id of the delivery district. */
    destinationID?: string;
    cityID?: string;
    voucherID?: string;
    shippingVoucherID?: string;
}

export interface CartItemRequestToCheckout {
    id: string;
    /** Only when lower than the cart's quantity (pickup adjustment). */
    qty?: number;
}