import { useAuthStore } from "./useAuthStore";

// Product image structure matching backend
export interface ProductImage {
  id: string;
  alt?: string;
  ALT?: string;  // Backend uses uppercase ALT
  name: string;
  src: string;
}

// Product interface matching backend
export interface Product {
  id: string | number;
  name: string;
  price: string;
  regularPrice?: string;
  images: ProductImage[];
  stock: number;
  stockStatus: string;
  weight?: string;
}

export interface ProductRecommendationDTO {
  thumbnail: string;
  slug: string;
  name: string;
  price: string;
  regularPrice: string;
}

export interface CartItemCreate {
  productId: string;
  variationId?: string;
  qty: number;
}

export interface CartItemUpdate {
  qty: number;
}

/**
 * Ensures a valid token is available before making API requests
 * @param token The authentication token
 * @returns True if the token is valid, false otherwise
 */
function validateToken(token: string | null | undefined): boolean {
  if (!token) {
    console.error("No authentication token available");
    return false;
  }
  return true;
}

/**
 * Add a single item to the cart
 */
export async function addItemToCart(item: CartItemCreate, token: string) {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/cart", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to add item to cart");
  }

  return await response.json();
}

/**
 * Add multiple items to the cart in sequence
 */
export async function addItemsToCart(items: CartItemCreate[], token: string) {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const results = [];

  for (const item of items) {
    const result = await addItemToCart(item, token);
    results.push(result);
  }

  return results;
}

/**
 * Get the current user's cart
 */
export async function getCart(token: string) {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/cart", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch cart");
  }

  return await response.json();
}

/**
 * Get product recommendations for the cart
 */
export async function getCartRecommendations(token?: string) {
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch("/api/cart/recommendations", {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to fetch recommendations");
  }

  return await response.json();
}

/**
 * Update the quantity of a cart item
 */
export async function updateCartItem(itemId: string, update: CartItemUpdate, token: string) {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`/api/cart/items/${itemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to update cart item");
  }

  return await response.json();
}

/**
 * Remove an item from the cart
 */
export async function removeCartItem(itemId: string, token: string) {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  if (!itemId || itemId === "undefined" || itemId.trim() === "") {
    throw new Error("Item ID is required");
  }

  // Ensure itemId is properly encoded in the URL
  const encodedItemId = encodeURIComponent(itemId);
  const apiUrl = `/api/cart/items/${encodedItemId}`;

  console.log("removeCartItem: Sending DELETE request", { itemId, encodedItemId, apiUrl });

  const response = await fetch(apiUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to remove cart item");
  }

  try {
    return await response.json();
  } catch (e) {
    // For 204 No Content responses or other responses without JSON
    return { success: true };
  }
}

/**
 * Clear all items from the cart
 */
export async function clearCart(token: string) {
  if (!validateToken(token)) {
    throw new Error("Authentication required");
  }

  const response = await fetch("/api/cart", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to clear cart");
  }

  return await response.json();
}

/**
 * Check if user is authenticated, otherwise redirect to login
 * Returns true if authenticated, false if redirected
 */
export function ensureAuthenticated(redirectPath?: string) {
  const { isAuthenticated } = useAuthStore.getState();

  if (!isAuthenticated) {
    // Handle client-side navigation
    if (typeof window !== 'undefined') {
      const returnPath = redirectPath || window.location.pathname + window.location.search;
      window.location.href = `/auth?from=${encodeURIComponent(returnPath)}`;
    }
    return false;
  }

  return true;
} 