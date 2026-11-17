/**
 * A delivery address as the storefront keeps it (localStorage, see
 * lib/store.ts) and sends it with a checkout.
 *
 * The customer picks the district from Biteship's area search:
 * `destinationID` is the Biteship area id, and `province`/`city`/
 * `subdistrict`/`postal_code` are Biteship's canonical names for it.
 * `address` is the free-text detail (street, house number, RT/RW).
 */
export interface Address {
    name: string;
    email: string;
    phone: string;
    province: string;
    city: string;
    subdistrict: string;
    destinationID: string;
    postal_code: string;
    address: string;
}

/** What a shipping quote needs to know about the destination. */
export interface ShippingDestinationInput {
    destinationID: string;
    postalCode: string;
}

/** The district part of an Address, as picked from the search. */
export type AddressArea = Pick<Address, 'province' | 'city' | 'subdistrict' | 'postal_code' | 'destinationID'>;

/** One line of text for a picked district, e.g. for the search box when editing. */
export const formatAddressArea = (area: AddressArea | null | undefined): string => {
    if (!area || !area.destinationID) return '';
    const parts = [area.subdistrict, area.city, area.province].filter(Boolean).join(', ');
    return area.postal_code ? `${parts}. ${area.postal_code}` : parts;
};

export interface StoreArea {
    name: string;
    cityIds: string[];
}

export interface Store {
    id: string;
    name: string;
    address: string;
    storeArea: StoreArea;
}

export interface PaymentGroup {
    name: string;
    key: string;
    paymentMethods: PaymentMethod[];
}

export interface PaymentMethod {
    id: string;
    name: string;
    key: string;
    description: string;
    excerpt: string;
    icon: string;
    paymentGroup: PaymentGroup;
    adminFee: number;
    adminFeeType: 'fixed' | 'percentage';
}

/** One row of GET /backend/address/search: a Biteship district + postal code. */
export interface AddressSearchResult {
    id: string;
    label: string;
    province_name: string;
    city_name: string;
    district_name: string;
    subdistrict_name: string;
    zip_code: string;
}
