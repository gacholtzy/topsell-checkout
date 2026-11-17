"use client";

import React from "react";
import { BranchStock } from "../interface/stock";
import { fetchBranchStock } from "../lib/stock-utils";
import { useAuthStore } from "../lib/useAuthStore";
import { useAddress } from "./address";
import { useShipping } from "./shipping";
import { useCart } from "./cart";

export const PICKUP_METHOD_TITLE = "Ambil di Toko";

interface PickupStockContextValue {
    stock: BranchStock | null;
    loading: boolean;
    /** Set when the check itself failed, as opposed to the branch being short. */
    error: string | null;
    /**
     * Whether checkout may proceed as far as stock is concerned.
     *
     * Deliberately true whenever pickup is not selected or the check has not
     * run: this gate exists to stop customers driving to a shop that cannot
     * fill their basket, not to block delivery orders. It goes false only on a
     * definite answer that the branch is short, on an error, or when nothing
     * is left in the order — because an unverified pickup is a promise we
     * cannot keep.
     */
    canCheckout: boolean;
    refresh: () => void;
    /**
     * Hands this context the answer the branch picker already has, so choosing
     * a shop shows its stock immediately instead of behind a spinner. One
     * revalidation then runs silently and corrects the seed if it has moved.
     */
    seedStock: (branchStock: BranchStock, forStoreId: string) => void;
    /**
     * The branch picker reports while it is open. No check runs meanwhile:
     * the selected store changes with every tap in the picker, and answering
     * for a branch the customer has not committed to only produced flicker —
     * and, worse, fought with the picker over the basket.
     */
    setPickerOpen: (open: boolean) => void;
}

const PickupStockContext = React.createContext<PickupStockContextValue>({
    stock: null,
    loading: false,
    error: null,
    canCheckout: true,
    refresh: () => { },
    seedStock: () => { },
    setPickerOpen: () => { },
});

export const PickupStockProvider = ({ children }: { children: React.ReactNode }) => {
    const { selectedStore } = useAddress();
    const { selectedShippingMethod } = useShipping();
    const { checkoutLines, resetPickupAdjustments } = useCart();
    const { token } = useAuthStore();

    const [stock, setStock] = React.useState<BranchStock | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = React.useState(false);

    const isPickup = selectedShippingMethod?.title === PICKUP_METHOD_TITLE;
    const storeId = selectedStore?.id;

    // The order as it stands — rows still in it, at the quantity being bought.
    // Re-checking on every change matters: a customer who takes "Ambil 2" or
    // puts a row back must see the branch's answer for THAT order, not the
    // one they arrived with.
    const itemIds = React.useMemo(
        () => checkoutLines.map((l) => l.id).join(","),
        [checkoutLines]
    );
    const qtys = React.useMemo(
        () => checkoutLines.map((l) => `${l.id}:${l.qty}`).join(","),
        [checkoutLines]
    );

    // One silent revalidation is allowed right after the picker seeds an
    // answer: same backend, seconds earlier, so a spinner would only replace a
    // correct screen with a wait. Every later check shows its state honestly —
    // a failure the customer cannot see is a payment button that never
    // enables and nobody knows why.
    const silentOnceFor = React.useRef<string | null>(null);

    const seedStock = React.useCallback((branchStock: BranchStock, forStoreId: string) => {
        silentOnceFor.current = forStoreId;
        setStock(branchStock);
        setError(null);
        setLoading(false);
    }, []);

    // Only the newest request may write to state. Two checks overlap whenever
    // the order changes while one is in flight, and the older answer landing
    // last used to put a "1 barang kurang" back on screen for a row that was
    // already out of the order.
    const seq = React.useRef(0);

    const check = React.useCallback(async () => {
        if (!isPickup || !storeId || !token) {
            seq.current++;
            setStock(null);
            setError(null);
            setLoading(false);
            return;
        }
        if (pickerOpen) return;
        if (!itemIds) {
            // Nothing left in the order; there is no question to ask.
            seq.current++;
            setStock(null);
            setError(null);
            setLoading(false);
            return;
        }

        const mine = ++seq.current;
        const silent = silentOnceFor.current === storeId;
        silentOnceFor.current = null;

        if (!silent) setLoading(true);
        setError(null);
        try {
            const result = await fetchBranchStock(token, storeId, itemIds, qtys);
            if (mine !== seq.current) return;
            setStock(result);
        } catch (e: any) {
            if (mine !== seq.current) return;
            if (!silent) {
                setStock(null);
                setError(e?.message || "Gagal memeriksa stok toko");
            }
        } finally {
            if (mine === seq.current) setLoading(false);
        }
    }, [isPickup, storeId, token, itemIds, qtys, pickerOpen]);

    React.useEffect(() => {
        check();
    }, [check]);

    // Changing branch, or leaving pickup, starts the order over: what one shop
    // was short of says nothing about the next one, and carrying "Ambil 2" or
    // an exclusion across would shrink an order for a branch that could have
    // filled it in full.
    const prevStore = React.useRef<string | undefined>(storeId);
    React.useEffect(() => {
        if (prevStore.current !== storeId) {
            prevStore.current = storeId;
            resetPickupAdjustments();
        }
    }, [storeId, resetPickupAdjustments]);
    React.useEffect(() => {
        if (!isPickup) resetPickupAdjustments();
    }, [isPickup, resetPickupAdjustments]);

    const canCheckout = React.useMemo(() => {
        if (!isPickup) return true;
        if (!storeId) return true; // a separate guard already blocks this
        if (checkoutLines.length === 0) return false; // everything was taken out
        if (loading) return false; // never let payment open on an unanswered check
        if (error) return false;
        if (!stock) return true;
        return stock.canCheckout;
    }, [isPickup, storeId, checkoutLines.length, loading, error, stock]);

    return (
        <PickupStockContext.Provider
            value={{ stock, loading, error, canCheckout, refresh: check, seedStock, setPickerOpen }}
        >
            {children}
        </PickupStockContext.Provider>
    );
};

export const usePickupStock = () => React.useContext(PickupStockContext);
