import { priceToIDR } from "./helper";

/** The shape both `/vouchers/all` and `/vouchers/me` return, narrowed to what display needs. */
interface DisplayableVoucher {
  type: string;
  discount: number;
  maxDiscount: number;
  endDate: string;
  effectiveEndDate?: string;
}

/**
 * Renders the discount in the unit its type actually means. `discount` is a bare
 * number, so a 2% voucher and a Rp2 voucher are indistinguishable without `type`.
 */
export const voucherDiscountLabel = (voucher: DisplayableVoucher): string => {
  if (voucher.type === "shipping") {
    return voucher.discount > 0 ? `Gratis ongkir s/d ${priceToIDR(voucher.discount)}` : "Gratis ongkir";
  }
  if (voucher.type === "percent") {
    const percent = `${voucher.discount}%`;
    return voucher.maxDiscount > 0 ? `${percent} (maks. ${priceToIDR(voucher.maxDiscount)})` : percent;
  }
  return priceToIDR(voucher.discount);
};

/**
 * The date the voucher stops working for *this* user. New-user vouchers carry a
 * campaign `endDate` decades out; the backend puts the user's own window close
 * (registration + masa berlaku) in `effectiveEndDate`.
 */
export const voucherEndDate = (voucher: DisplayableVoucher): string =>
  voucher.effectiveEndDate || voucher.endDate;

/** Where a voucher may be used, by how the order reaches the customer. */
export type VoucherFulfillment = "all" | "delivery" | "pickup";

/**
 * A short label for a voucher limited to one side of the shipping choice, or
 * null when it applies to both. Shown on the voucher itself so the customer
 * learns the limit BEFORE switching shipping method and watching it grey out.
 */
export const voucherScopeLabel = (voucher: { fulfillmentType?: VoucherFulfillment | string }): string | null => {
  if (voucher.fulfillmentType === "pickup") return "Khusus Ambil di Toko";
  if (voucher.fulfillmentType === "delivery") return "Khusus Diantar ke Alamat";
  return null;
};

/**
 * Whether a voucher may be used with the chosen shipping method. A voucher with
 * no `fulfillmentType` — one created before the field existed — allows both.
 *
 * Mirrors the backend rule rather than replacing it: the server still refuses a
 * mismatched voucher at checkout. This exists so the page can drop a stale
 * selection the instant the method changes, instead of letting the customer
 * press pay on a voucher the server is about to reject.
 */
export const voucherAllowsFulfillment = (
  voucher: { fulfillmentType?: VoucherFulfillment | string },
  isPickup: boolean
): boolean => {
  if (voucher.fulfillmentType === "pickup") return isPickup;
  if (voucher.fulfillmentType === "delivery") return !isPickup;
  return true;
};
