// Live per-branch stock, straight from the POS behind the shop counter.
//
// Two outcomes reach the customer: enough stock, or not enough. A product the
// POS has never heard of counts as zero by an explicit business decision, so it
// is worded exactly like an empty shelf; `unresolved` survives only so support
// and logs can tell a mapping gap from a real sell-out.
export interface StockItem {
    /**
     * The cart row this answer is about — the same id checkout submits. It is
     * what lets an unfillable row be dropped from the order; productId cannot,
     * because one product can occupy more than one cart row.
     */
    itemId: string;
    productId: string;
    variationId?: string;
    sku: string;
    barcode?: string;
    name?: string;
    requested: number;
    available: number;
    /** The branch can cover the requested quantity. */
    sufficient: boolean;
    /**
     * The line could not be mapped to the POS. Diagnostic only — it already
     * arrives with available 0, and the UI must not word it differently.
     */
    unresolved: boolean;
    reason?: string;
    /** Ready-to-render Indonesian wording; empty when the line is fine. */
    message?: string;
}

export interface BranchStock {
    branchCode: string;
    branchId: number;
    branchName: string;
    items: StockItem[];
    /** Every line is covered. */
    complete: boolean;
    /** Whether checkout may proceed. Mirrors `complete` — never re-derive it. */
    canCheckout: boolean;
    /** Headline wording for the whole basket. */
    message: string;
}

export interface BranchStockResponse {
    status: number;
    message: string;
    data: BranchStock;
}

/** One row of the store picker: enough to colour a badge before committing. */
export interface BranchSummary {
    storeId: string;
    storeName: string;
    areaName?: string;
    address?: string;
    branchCode: string;
    /**
     * Deliberately optimistic — a branch holding only part of the basket still
     * reads as available. Someone choosing a shop wants to know it is worth
     * opening; the shortfall is spelled out per item once they pick it.
     */
    available: boolean;
    availableItems: number;
    totalItems: number;
    /** False when the branch's POS could not be reached at all. */
    reachable: boolean;
    /**
     * The lines this branch cannot fill, by name. Counts alone ("2 of 3") leave
     * the customer unable to judge whether the missing item matters to them.
     */
    missingItems?: StockItem[];
    /**
     * Basket rows Affari was never asked about — ebikes. They are not missing,
     * so they count towards the figures the customer reads. Never towards the
     * decisions: filtering and selectability run on the checked rows alone.
     */
    unmonitoredItems?: number;
    /**
     * The full answer for this branch, identical to what the per-branch check
     * would return. Present so picking a branch needs no second round trip —
     * the checkout page is seeded from this and only revalidates quietly.
     */
    stock?: BranchStock;
}
