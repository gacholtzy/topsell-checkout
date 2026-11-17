"use client";

import { Product } from "@/interface/product";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense } from "react";
import { toast } from "../hooks/use-toast";
import { useAuthStore } from "@/lib/useAuthStore";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter } from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import { AlertCircleIcon, XCircleIcon } from "lucide-react";

/** One row of the order as it will be submitted. */
export interface CheckoutLine {
    /** Cart item id. */
    id: string;
    /** Quantity bought in this order — the cart's, unless lowered at the pickup step. */
    qty: number;
}

interface CartContextType {
    /** Every cart row the customer arrived with, at the cart's own quantity. */
    cartItemsToCheckout: Product[];
    /** The cart item ids from the URL, comma-separated. Never narrowed. */
    cartQuery: string;
    /**
     * Adjustments made at the pickup step, when a branch holds less than the
     * cart asks for. They shape this order only: the cart itself is untouched
     * until the order is placed, and every adjustment is the customer's own
     * tap — nothing is taken out of an order on their behalf.
     */
    excludedItemIds: string[];
    qtyOverrides: Record<string, number>;
    /** The order as it stands: rows not excluded, at the quantity being bought. */
    checkoutLines: CheckoutLine[];
    excludeFromCheckout: (itemId: string) => void;
    includeInCheckout: (itemId: string) => void;
    /** Lower the quantity for this order; null puts the cart's own back. */
    setCheckoutQty: (itemId: string, qty: number | null) => void;
    resetPickupAdjustments: () => void;
    totalQtyToCheckout: number;
    totalPriceToCheckout: number;
    alertDialogMessage?: string;
    alertDialogTitle?: string;
    alertDialogVariant?: "default" | "destructive";
    setAlertDialogMessage?: (message: string) => void;
    setAlertDialogTitle?: (title: string) => void;
    setAlertDialogVariant?: (variant: "default" | "destructive") => void;
    setOpenAlertDialog?: (open: boolean) => void;
}

const CartContext = React.createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <Suspense fallback={
            <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
        }>
            <CartProviderContent>{children}</CartProviderContent>
        </Suspense>
    )
}

const CartProviderContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const searchParams = useSearchParams();
    const [cartItemsToCheckout, setCartItemsToCheckout] = React.useState<Product[]>([]);
    const [cartQuery, setCartQuery] = React.useState<string>("");
    const [excludedItemIds, setExcludedItemIds] = React.useState<string[]>([]);
    const [qtyOverrides, setQtyOverrides] = React.useState<Record<string, number>>({});
    const [openAlertDialog, setOpenAlertDialog] = React.useState<boolean>(false);
    const [alertDialogMessage, setAlertDialogMessage] = React.useState<string>("");
    const [alertDialogTitle, setAlertDialogTitle] = React.useState<string>("");
    const [alertDialogVariant, setAlertDialogVariant] = React.useState<"default" | "destructive">("default");
    const { token } = useAuthStore()
    const router = useRouter();

    const getCartQuery = () => {
        const cartQueryString = searchParams.get('cart');
        if (!cartQueryString) {
            router.push('/cart');
            // window.location.href = 'https://links.topsellbelanja.com/promo-tsb';
        }
        if (cartQueryString) {
            const cart = decodeBase64String(cartQueryString);
            setCartQuery(cart);
        }
    }

    const decodeBase64String = (base64String: string) => {
        try {
            return atob(base64String).trim().replace(/([{,])(\w+):/g, '$1"$2":');
        } catch (error) {
            toast({
                title: 'Error',
                description: "Invalid url",
                variant: 'destructive'
            });
            return '[]';
        }
    }

    const excludeFromCheckout = React.useCallback((itemId: string) => {
        setExcludedItemIds((prev) => (prev.includes(itemId) ? prev : [...prev, itemId]));
        setQtyOverrides((prev) => {
            if (!(itemId in prev)) return prev;
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    }, []);

    const includeInCheckout = React.useCallback((itemId: string) => {
        setExcludedItemIds((prev) => prev.filter((id) => id !== itemId));
    }, []);

    const setCheckoutQty = React.useCallback((itemId: string, qty: number | null) => {
        setQtyOverrides((prev) => {
            const next = { ...prev };
            if (qty === null || qty < 1) delete next[itemId];
            else next[itemId] = qty;
            return next;
        });
    }, []);

    const resetPickupAdjustments = React.useCallback(() => {
        setExcludedItemIds((prev) => (prev.length === 0 ? prev : []));
        setQtyOverrides((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    }, []);

    const checkoutLines = React.useMemo<CheckoutLine[]>(() => {
        const excluded = new Set(excludedItemIds);
        return cartItemsToCheckout
            .filter((p) => p.cartItemId && !excluded.has(p.cartItemId))
            .map((p) => {
                const id = p.cartItemId as string;
                const override = qtyOverrides[id];
                // An override only ever lowers: the cart is the ceiling.
                const qty = override && override < p.qty ? override : p.qty;
                return { id, qty };
            });
    }, [cartItemsToCheckout, excludedItemIds, qtyOverrides]);

    // Totals follow the order, not the cart: a row taken out or trimmed at the
    // pickup step must drop out of the figure the customer is asked to pay.
    const { totalQtyToCheckout, totalPriceToCheckout } = React.useMemo(() => {
        const byId = new Map(cartItemsToCheckout.map((p) => [p.cartItemId, p]));
        let qty = 0;
        let price = 0;
        for (const line of checkoutLines) {
            const product = byId.get(line.id);
            if (!product) continue;
            const unit = product.regularPrice && product.regularPrice != 0 ? +product.regularPrice : +product.price;
            qty += line.qty;
            price += unit * line.qty;
        }
        return { totalQtyToCheckout: qty, totalPriceToCheckout: price };
    }, [cartItemsToCheckout, checkoutLines]);

    const fetchCartItemsToCheckout = async () => {
        const ids = (cartQuery?.split(',') ?? []).map((id) => id.trim()).filter(Boolean)
        // Fetched together rather than one after another: each row is its own
        // request and a basket of six used to load in six round trips.
        const rows = await Promise.all(ids.map(async (id) => {
            const res = await fetch(`/backend/carts/items/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.status != 200 || !data.data) return null;
            // The row's own id travels with it: the pickup step adjusts and
            // the checkout payload names rows by cart item id, which the
            // product payload does not otherwise carry.
            return { ...(data.data as Product), cartItemId: id } as Product;
        }));

        if (rows.some((r) => r === null)) {
            router.push('/cart');
            return;
        }
        setCartItemsToCheckout(rows as Product[]);
    }

    React.useEffect(() => {
        getCartQuery();
    }, []);

    React.useEffect(() => {
        if (cartQuery) {
            fetchCartItemsToCheckout();
        }
    }, [cartQuery]);

    return (
        <CartContext.Provider value={{ cartItemsToCheckout, cartQuery, excludedItemIds, qtyOverrides, checkoutLines, excludeFromCheckout, includeInCheckout, setCheckoutQty, resetPickupAdjustments, totalQtyToCheckout, totalPriceToCheckout, alertDialogMessage, alertDialogTitle, alertDialogVariant, setAlertDialogMessage, setAlertDialogTitle, setAlertDialogVariant, setOpenAlertDialog }}>
            {children}
            <AlertDialog open={openAlertDialog} onOpenChange={setOpenAlertDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle></AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="flex flex-col items-center justify-center">
                        {
                            alertDialogVariant === "default" && (
                                <>
                                    <AlertCircleIcon className="w-10 h-10" />
                                    <h3 className="text-lg font-semibold">{alertDialogTitle}</h3>
                                    <p className="text-sm text-gray-500">{alertDialogMessage}</p>
                                </>
                            ) ||
                            alertDialogVariant === "destructive" && (
                                <>
                                    <XCircleIcon className="w-10 h-10" />
                                    <h3 className="text-lg font-semibold">{alertDialogTitle}</h3>
                                    <p className="text-sm text-gray-500">{alertDialogMessage}</p>
                                </>
                            )
                        }
                    </div>
                    <AlertDialogFooter>
                        <Button variant="outline"
                            onClick={() => {
                                setOpenAlertDialog(false);
                            }}
                        >OK</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CartContext.Provider>
    )
}

export const useCart = () => {
    const context = React.useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}