/**
 * Points utilities for fetching user points data
 */

/**
 * Validate token before making API calls
 */
function validateToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.trim().length > 0;
}

export interface Point {
  points: number,
  type: string,
  description: string,
}

export interface PointsResponse {
  status: number;
  message: string;
  data: {
    points: Point[],
    total: number,
    total_pages: number,
  };
}

/**
 * Get the user's points information
 */
export async function getUserPoints(token: string): Promise<PointsResponse> {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/points", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch user points");
  }

  return await response.json();
}

/* ------------------------------------------------------------------ */
/* New loyalty point system (lot-based ledger + redeem catalog)        */
/* Calls the Go backend via the /backend/* rewrite with a Bearer token */
/* ------------------------------------------------------------------ */

export interface PointBalance {
  userID: string;
  activePoints: number;
  expiringSoonPoints: number;
  pointToRupiah: number;
}

export interface PointExpiringLot {
  lotID: string;
  remaining: number;
  expiresAt: string;
}

export interface PointExpiringSoon {
  totalExpiring: number;
  lots: PointExpiringLot[];
}

// One row of the immutable point ledger.
export interface PointLedger {
  id: string;
  userID: string;
  type: "earn" | "redeem" | "expire" | "refund";
  amount: number; // earn positive; redeem/expire/refund negative
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface PointHistory {
  data: PointLedger[];
  total: number;
  totalPages: number;
}

export interface RedeemCatalogItem {
  id: string;
  name: string;
  pointCost: number;
  discountValue: number;
  status: string;
  validityDays: number;
  minTransaction: number;
}

interface GlobalResponse<T> {
  status: number;
  message: string;
  data: T;
}

async function backendGet<T>(path: string, token: string): Promise<T> {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }
  const response = await fetch(`/backend/points/${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await response.json()) as GlobalResponse<T>;
  if (!response.ok) {
    throw new Error(json?.message || "Failed to fetch points data");
  }
  return json.data;
}

/** Active balance + points expiring within the reminder window. */
export async function getPointBalance(token: string): Promise<PointBalance> {
  return backendGet<PointBalance>("balance", token);
}

/** Lots expiring soon. */
export async function getExpiringSoon(token: string): Promise<PointExpiringSoon> {
  return backendGet<PointExpiringSoon>("expiring-soon", token);
}

/** Paginated ledger history (earn/redeem/expire/refund). */
export async function getPointHistory(
  token: string,
  page = 1,
  limit = 10
): Promise<PointHistory> {
  return backendGet<PointHistory>(`history?page=${page}&limit=${limit}`, token);
}

/** Active redeem catalog items. */
export async function getRedeemCatalog(token: string): Promise<RedeemCatalogItem[]> {
  const data = await backendGet<RedeemCatalogItem[] | null>("catalog", token);
  return data ?? [];
}

/** A voucher owned by the user (shown on the "Voucher Saya" page). */
export interface MyVoucher {
  id: string;
  name: string;
  type: string;
  description: string;
  minTransaction: number;
  discount: number;
  maxDiscount: number;
  startDate: string;
  endDate: string;
  /** When the voucher stops working for the current user; differs from endDate for new-user vouchers. */
  effectiveEndDate?: string;
  /** Limits the voucher to delivery or pickup orders; absent or "all" means both. */
  fulfillmentType?: "all" | "delivery" | "pickup";
}

/** Vouchers owned by the authenticated user that are currently active. */
export async function getMyVouchers(token: string): Promise<MyVoucher[]> {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }
  const response = await fetch(`/backend/vouchers/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await response.json()) as GlobalResponse<MyVoucher[] | null>;
  if (!response.ok) {
    throw new Error(json?.message || "Gagal memuat voucher");
  }
  return json.data ?? [];
}

/** Redeem a catalog item for a voucher. Returns the generated voucher. */
export async function redeemPoint(token: string, catalogID: string): Promise<any> {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }
  const response = await fetch(`/backend/points/redeem`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ catalogID }),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.message || "Gagal menukar poin");
  }
  return json.data;
}