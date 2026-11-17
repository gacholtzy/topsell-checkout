export interface ShippingMethod {
    id: string;
    title: string;
    description: string;
    order: number;
}

/**
 * One courier service Biteship offers for the cart and address, as returned by
 * POST /backend/shippings/options. `price` is what the customer pays (after the
 * Topsell subsidy); `listPrice` is the courier's own tariff.
 */
export interface ShippingOption {
    courierCode: string;
    courierName: string;
    courierServiceCode: string;
    courierServiceName: string;
    /** standard, express, overnight, cargo, ... as Biteship classifies it. */
    serviceType: string;
    shippingType: string;
    /** e.g. "2 - 3 days" */
    duration: string;
    price: number;
    listPrice: number;
    freeArea: boolean;
}

/** "JNE Reguler" */
export const shippingOptionLabel = (o: ShippingOption | null | undefined): string => {
    if (!o) return '';
    return [o.courierName, o.courierServiceName].filter(Boolean).join(' ');
};

/** "2 - 3 days" -> "2 - 3 hari" */
export const shippingOptionDuration = (o: ShippingOption | null | undefined): string => {
    if (!o?.duration) return '';
    return o.duration
        .replace(/\bdays?\b/gi, 'hari')
        .replace(/\bhours?\b/gi, 'jam')
        .replace(/\bminutes?\b/gi, 'menit');
};

/** The two fields a quote or checkout needs to name the picked service. */
export const shippingOptionKey = (o: ShippingOption | null | undefined) => ({
    courierCode: o?.courierCode || '',
    courierServiceCode: o?.courierServiceCode || '',
});
