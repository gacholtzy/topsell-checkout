import { PaymentMethod, Store } from "./address";
import { ProductCategory, ProductImage } from "./product";
import { ShippingMethod } from "./shipping";
import { Voucher } from "./voucher";

export interface Order {
    id: string;
    invoice: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    total: number;
    ongkir: number;
    adminFee: number;
    voucherID: string;
    voucher: Voucher;
    voucherDiscount: number;
    paymentMethodID: string;
    paymentMethod: PaymentMethod;
    shippingID: string;
    shipping: ShippingMethod;
    products: OrderProduct[];
    status: string;
    bankAccountName: string;
    bankAccountNumber: string;
    createdAt: string;
    areaID: string;
    area: Store;
}

export interface OrderProduct {
    id: string;
    name: string;
    price: number;
    regularPrice: number;
    categories: ProductCategory[];
    images: ProductImage[];
    variant: string;
    weight: number;
    qty: number;
}

// QR Code related interfaces
export interface QRCodeResponse {
    status: number;
    message: string;
    data: QRCodeData;
}

export interface QRCodeData {
    invoice: string;
    qrString: string;
    amount: number;
    status: string;
    paymentType: string;
}
