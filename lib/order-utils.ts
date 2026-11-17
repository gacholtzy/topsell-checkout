/**
 * Order utilities for fetching order history
 */

/**
 * Validate token before making API calls
 */
function validateToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && token.trim().length > 0;
}

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: string;
  regularPrice: string;
  images: {
    src: string
  }[];
}

export interface Order {
  id: string;
  invoice: string;
  status: string;
  total: number;
  createdAt: string;
  products: OrderItem[];
  address?: string;
  ongkir?: number;
  adminFee?: number;
  shipping?: {
    title: string
  };
  /** Entered by staff in the dashboard once the parcel is handed to a courier. Empty until then. */
  trackingNumber?: string;
  /** The courier's display name ("J&T Express"); empty for orders shipped before couriers were recorded. */
  courierName?: string;
  /**
   * Where the customer can follow the parcel. Built by the backend and empty when
   * there is nothing to open — no courier chosen, or our own Topsell Delivery,
   * which no public tracking site knows — so the button is shown only when it is set.
   */
  trackingUrl?: string;
  /** Biteship courier service picked at checkout, e.g. "jne" / "Reguler". */
  courierCompany?: string;
  courierServiceName?: string;
  /** Biteship's latest shipment status and its Indonesian label; empty until booked. */
  biteshipStatus?: string;
  biteshipStatusLabel?: string;
  biteshipTrackingID?: string;
  paymentMethod?: {
    key?: string
    name: string
    icon: string
  };
  /** Midtrans Snap page to pay on. Only on the customer's own pending orders; empty for manual transfer and for methods with no page. */
  paymentUrl?: string;
  /**
   * Seconds left to pay, as of the moment the list was loaded. A duration and not a
   * timestamp on purpose: counting down from it needs no trust in the device clock.
   * Absent when the deadline was never recorded (orders from before it was).
   */
  paymentSecondsLeft?: number;
  voucherDiscount?: number;
  shippingVoucherDiscount?: number;
  shippingVoucher?: {
    name: string
  };
  voucher?: {
    name: string
  }
}

export interface OrderHistoryResponse {
  status: number;
  message: string;
  data: Order[];
  total: number;
  totalPage: number;
}

/**
 * Get the user's order history
 */
export async function getOrderHistory(token: string, status: string, page: number, limit: number): Promise<OrderHistoryResponse> {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/orders?page=${page}&limit=${limit}&status=${status}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch order history");
  }

  return await response.json();
} 