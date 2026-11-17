export interface Product {
    id: string;
    name: string;
    price: number;
    regularPrice: number;
    categories: ProductCategory[];
    images: ProductImage[];
    variationName: string;
    variationId?: string;
    qty: number;
    /** Set on checkout rows: the cart item id the row was loaded from. */
    cartItemId?: string;
}

export interface ProductCategory {
    id: string;
    name: string;
}

export interface ProductImage {
    id: string;
    name: string;
    src: string;
    alt?: string;
    ALT?: string;
}

export interface ProductIDSAndQuantity {
    id: string;
    quantity: number;
    variationId?: string;
}

export interface ProductQuery {
    productId: string;
    variationId?: string;
    qty: number;
}
