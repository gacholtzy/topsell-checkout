"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseItemsParam } from "@/context/reference";
import { useAuthStore } from "@/lib/useAuthStore";
import { useToast } from "@/hooks/use-toast";
import { CartItemCreate } from "@/lib/cart-utils";
import { AlertCircleIcon } from "lucide-react";

/**
 * Landing page for the shop's "beli" links: /add-to-cart?items=<base64>.
 *
 * Order of business, on purpose:
 *  1. Wait for the stored session to load (localStorage), so a signed-in
 *     customer is not mistaken for a guest during the first render.
 *  2. A guest is sent to the cart with the items parked in sessionStorage;
 *     the cart page opens the login box and adds them after sign-in. This
 *     happens BEFORE any product is fetched: a guest must never be stuck on
 *     an error that has nothing to do with them.
 *  3. A signed-in customer's items are added one by one, straight away. The
 *     products are not fetched first: only id + qty are sent, and fetching
 *     them (one request per product and per variation, in sequence) only
 *     delayed the cart. A product that is gone fails the add and is reported.
 *     The adds stay sequential so the API never races on the same cart.
 */
export default function AddToCartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productsQuery = useMemo(() => parseItemsParam(searchParams.get("items")), [searchParams]);
  const { isAuthenticated, token } = useAuthStore();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (useAuthStore.persist?.hasHydrated()) setHydrated(true);
    const unsub = useAuthStore.persist?.onFinishHydration(() => setHydrated(true));
    return () => unsub?.();
  }, []);

  // Step 2: guests go to the cart (with the items parked) and log in there.
  useEffect(() => {
    if (!hydrated || isAuthenticated) return;
    const items = parseItemsParam(searchParams.get("items"));
    if (items.length > 0) {
      const cartItems: CartItemCreate[] = items.map((product) => ({
        productId: product.productId,
        variationId: product.variationId || "",
        qty: product.qty,
      }));
      sessionStorage.setItem("pending-add-to-cart", JSON.stringify(cartItems));
    } else {
      sessionStorage.setItem("pending-add-to-cart-params", searchParams.toString());
    }
    router.replace("/cart");
  }, [hydrated, isAuthenticated, router, searchParams]);

  // A link without readable items has nowhere to go.
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    if (parseItemsParam(searchParams.get("items")).length === 0) {
      setError("Tautan produk tidak valid. Silakan buka produknya lagi dari toko.");
      setIsLoading(false);
    }
  }, [hydrated, isAuthenticated, searchParams]);

  // Step 3: signed in -> add them.
  useEffect(() => {
    if (!hydrated || !isAuthenticated || started) return;
    if (productsQuery.length === 0) return;
    setStarted(true);

    const processCart = async () => {
      try {
        setIsLoading(true);
        const cartItems: CartItemCreate[] = productsQuery.map((product) => ({
          productId: product.productId,
          variationId: product.variationId || "",
          qty: product.qty,
        }));

        let completedItems = 0;
        let failedItems = 0;
        for (const item of cartItems) {
          try {
            const res = await fetch("/api/cart", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(item),
            });
            if (res.status === 401) {
              // The session guard signs us out; the guest branch above then
              // parks the items and sends the customer to log in.
              return;
            }
            if (!res.ok) failedItems++;
          } catch (itemError) {
            console.error("Error adding item:", item, itemError);
            failedItems++;
          } finally {
            completedItems++;
            setProgress(Math.floor((completedItems / cartItems.length) * 100));
          }
        }

        if (failedItems === cartItems.length) {
          throw new Error("Produk tidak dapat ditambahkan ke keranjang. Silakan coba lagi.");
        }
        toast({
          title: failedItems > 0 ? "Sebagian produk ditambahkan" : "Berhasil",
          description: failedItems > 0
            ? `${cartItems.length - failedItems} dari ${cartItems.length} produk masuk keranjang.`
            : "Produk berhasil ditambahkan ke keranjang.",
        });
        setTimeout(() => router.push("/cart"), 800);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Produk tidak dapat ditambahkan ke keranjang.";
        setError(message);
        toast({ title: "Gagal", description: message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    processCart();
  }, [hydrated, isAuthenticated, started, productsQuery, token, router, toast]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircleIcon className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Produk belum bisa ditambahkan</h1>
        <p className="text-center text-muted-foreground mb-6 max-w-md">{error}</p>
        <div className="flex gap-3">
          <button
            className="px-4 py-2 border rounded-md hover:bg-secondary/60"
            onClick={() => window.location.reload()}
          >
            Coba lagi
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            onClick={() => router.push("/cart")}
          >
            Ke Keranjang
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="w-64 h-2 bg-gray-200 rounded-full mb-4">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-lg">
            {!hydrated || !isAuthenticated
              ? "Menyiapkan keranjang..."
              : progress < 100
                ? `Menambahkan produk ke keranjang... ${progress}%`
                : "Mengalihkan ke keranjang..."}
          </p>
        </div>
      )}
    </>
  );
}
