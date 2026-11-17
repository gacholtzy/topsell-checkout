import { ProductQuery } from "../interface/product";

/**
 * Decodes the ?items= parameter WooCommerce builds: base64 of a JSON-ish array
 * whose keys are unquoted ("[{productId:1,variationId:2,qty:1}]"). Returns []
 * for anything unreadable rather than throwing, so callers decide what to show.
 */
export const parseItemsParam = (itemsQueryString: string | null): ProductQuery[] => {
    if (!itemsQueryString) return [];
    try {
        const json = atob(itemsQueryString).trim().replace(/([{,])(\w+):/g, '$1"$2":');
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};
