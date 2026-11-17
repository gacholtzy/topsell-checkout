import { BranchStock, BranchStockResponse, BranchSummary } from "../interface/stock";

/**
 * Ask the backend whether one branch can fill the current cart.
 *
 * Pass a storeId for "Ambil di Toko" to check that specific shop; omit it and
 * the backend answers for the default online branch, which is what the cart
 * page shows. itemIds narrows the check to the cart rows being checked out.
 */
export async function fetchBranchStock(
    token: string,
    storeId?: string,
    itemIds?: string,
    qtys?: string
): Promise<BranchStock> {
    const params = new URLSearchParams();
    if (storeId) params.set("storeId", storeId);
    // The same cart item ids checkout submits, so the check covers exactly the
    // rows being bought rather than the whole cart.
    if (itemIds) params.set("itemIds", itemIds);
    // "<itemId>:<qty>,…" — the quantity being bought per row, so a row the
    // customer trimmed to what the branch has is checked at that figure.
    if (qtys) params.set("qtys", qtys);
    const query = params.toString() ? `?${params.toString()}` : "";

    const response = await fetch(`/backend/carts/stock${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
        // The backend already phrases these for customers (branch unreachable,
        // integration down, store not linked to the POS), so pass its wording
        // through rather than inventing our own.
        throw new Error(
            body?.message || "Gagal memeriksa stok toko. Silakan coba lagi."
        );
    }

    return (body as BranchStockResponse).data;
}

/**
 * Availability for every pickup store at once, for the branch picker.
 *
 * Never throws: the picker has to work whether or not the POS answers, so a
 * failure degrades to no badges rather than an error dialog.
 */
export async function fetchBranchSummaries(
    token: string,
    itemIds?: string
): Promise<BranchSummary[]> {
    try {
        const query = itemIds ? `?itemIds=${encodeURIComponent(itemIds)}` : "";
        const response = await fetch(`/backend/carts/stock/branches${query}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
        if (!response.ok) return [];
        const body = await response.json();
        return (body?.data as BranchSummary[]) ?? [];
    } catch {
        return [];
    }
}
