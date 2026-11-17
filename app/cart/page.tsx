"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Recommendations } from "@/components/cart/recommendations";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { NumberField } from "@/components/base/number-field/number-field";
import { Spinner } from "@/components/base/spinner/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/useAuthStore";
import { useToast } from "@/hooks/use-toast";
import { getCart, updateCartItem, removeCartItem, clearCart, ProductImage, Product, getCartRecommendations, ProductRecommendationDTO } from "@/lib/cart-utils";
import { getImageAlt, getImageSrc } from "@/lib/image-utils";
import { priceToIDR } from "@/lib/helper";
import { Trash2Icon, MinusIcon, PlusIcon, ShoppingCartIcon, CheckCircle2 } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Link from "next/link";
import AuthModal from "@/components/auth-modal-lazy";
type Recommendation = ProductRecommendationDTO;

interface CartItem {
  id: string;
  productId: string;
  variationId?: string;
  qty: number;
  price: string;
  regularPrice?: string;
  name: string;
  stock: number;
  stockStatus: string;
  images: ProductImage[];
}

interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export default function CartPage() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Cart | null>(null);
  const [updatingItem, setUpdatingItem] = useState<string | null>(null);
  const [clearingCart, setClearingCart] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [selectAll, setSelectAll] = useState(false);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [processingPending, setProcessingPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand to hydrate from localStorage before checking auth
  useEffect(() => {
    const checkHydration = () => {
      const isHydrated = useAuthStore.persist?.hasHydrated();
      if (isHydrated) {
        setHydrated(true);
      }
    };
    checkHydration();
    const unsub = useAuthStore.persist?.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsub?.();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await getCart(token || "");
      // The backend may answer items: null for a cart whose rows could not
      // be resolved; every reader below indexes items, so normalise once.
      const data = response.data
        ? { ...response.data, items: response.data.items ?? [] }
        : null;
      setCart(data);

      // Initialize all items as selected
      if (data) {
        const initialSelectedState: Record<string, boolean> = {};
        data.items.forEach((item: CartItem) => {
          // Only select items that are in stock
          initialSelectedState[item.id] = item.stock > 0;
        });
        setSelectedItems(initialSelectedState);
        // Set selectAll only if all items are in stock
        setSelectAll(data.items.every((item: CartItem) => item.stock > 0));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memuat keranjang",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Process pending add-to-cart items from sessionStorage
  const processPendingCartItems = async (authToken: string) => {
    const pendingItems = sessionStorage.getItem("pending-add-to-cart");
    if (!pendingItems) return;

    try {
      setProcessingPending(true);
      const cartItems = JSON.parse(pendingItems);
      
      for (const item of cartItems) {
        try {
          await fetch("/api/cart", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(item),
          });
        } catch (itemError) {
          console.error("Error adding pending item:", item, itemError);
        }
      }

      // Clear pending items after processing
      sessionStorage.removeItem("pending-add-to-cart");
      sessionStorage.removeItem("pending-add-to-cart-params");

      toast({
        title: "Berhasil",
        description: "Produk berhasil ditambahkan ke keranjang",
      });
    } catch (error) {
      console.error("Error processing pending cart items:", error);
    } finally {
      setProcessingPending(false);
    }
  };

  // Handle successful authentication from modal
  const handleAuthenticated = () => {
    window.location.reload();
  };

  useEffect(() => {
    // Wait for Zustand hydration before deciding
    if (!hydrated) return;

    if (!isAuthenticated) {
      // Show the login modal: at once when the customer arrived from a shop
      // link with items waiting (they came here to buy, not to browse), after
      // a short pause otherwise.
      setLoading(false);
      const hasPending = !!sessionStorage.getItem("pending-add-to-cart");
      const timer = setTimeout(() => {
        setShowAuthModal(true);
      }, hasPending ? 0 : 2000);
      return () => clearTimeout(timer);
    }

    // Already authenticated, hide modal
    setShowAuthModal(false);

    // Process any pending add-to-cart items (from /add-to-cart redirect), then fetch cart
    const init = async () => {
      await processPendingCartItems(token || "");
      await fetchCart();
    };
    init();
  }, [hydrated, isAuthenticated, token, router]);

  // fetch recommendations after cart loaded
  const fetchRecommendations = async () => {
    try {
      setRecoLoading(true);
      const json = await getCartRecommendations(token || undefined);
      const list = (json?.data || []) as Recommendation[];
      setRecommendations(list);
    } catch (e) {
      // optional toast on error
    } finally {
      setRecoLoading(false);
    }
  };
  useEffect(() => {
    if (hydrated) fetchRecommendations();
  }, [hydrated, isAuthenticated, token]);

  // Toggle selection of a specific item
  const toggleItemSelection = (itemId: string) => {
    // Find the item to check its stock
    const item = cart?.items.find(item => item.id === itemId);

    // Don't allow toggling if item is out of stock
    if (item && item.stock <= 0) {
      return;
    }

    setSelectedItems(prev => {
      const newSelectedItems = { ...prev, [itemId]: !prev[itemId] };

      // Update selectAll state based on if all items with stock > 0 are selected
      const allInStockSelected = cart?.items
        .filter(item => item.stock > 0)
        .every(item => newSelectedItems[item.id]) ?? false;
      setSelectAll(allInStockSelected);

      return newSelectedItems;
    });
  };

  // Toggle selection of all items
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);

    if (cart) {
      const newSelectedItems: Record<string, boolean> = { ...selectedItems };
      cart.items.forEach((item: CartItem) => {
        // Only update items that are in stock
        if (item.stock > 0) {
          newSelectedItems[item.id] = newSelectAll;
        }
      });
      setSelectedItems(newSelectedItems);
    }
  };

  // Calculate total for selected items only
  const calculateSelectedTotal = () => {
    if (!cart || !cart.items.length) return 0;

    return cart.items.reduce((total, item) => {
      if (selectedItems[item.id]) {
        const itemPrice = parseFloat(item.price);
        return total + (itemPrice * item.qty);
      }
      return total;
    }, 0);
  };

  // Get count of selected items
  const getSelectedItemCount = () => {
    return Object.values(selectedItems).filter(Boolean).length;
  };

  // Proceed to checkout with only selected items
  const handleCheckout = () => {
    if (getSelectedItemCount() === 0) {
      toast({
        title: "Tidak ada item yang dipilih",
        description: "Silakan pilih setidaknya satu item untuk checkout",
        variant: "destructive",
      });
      return;
    }

    // Create a comma-separated list of selected item IDs to pass to checkout
    const selectedItemIds = Object.entries(selectedItems)
      .filter(([_, isSelected]) => isSelected)
      .map(([id, _]) => id)
      .join(',');

    // encode the selected item ids to base64
    const encodedSelectedItemIds = btoa(selectedItemIds);
    // redirect to the checkout page with the encoded selected item ids
    router.push(`/?cart=${encodedSelectedItemIds}`);
  };

  const handleUpdateQuantity = async (itemId: string, newQty: number) => {
    if (newQty < 1) return;

    // Find the item to check stock
    const item = cart?.items.find(item => item.id === itemId);
    if (!item) return;

    // Check if new quantity exceeds stock
    if (newQty > item.stock) {
      toast({
        title: "Error",
        description: "Tidak dapat melebihi stok yang tersedia",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdatingItem(itemId);
      await updateCartItem(itemId, { qty: newQty }, token || "");

      // Update the local cart state
      setCart(prevCart => {
        if (!prevCart) return null;

        return {
          ...prevCart,
          items: prevCart.items.map(item =>
            item.id === itemId ? { ...item, qty: newQty } : item
          )
        };
      });

      toast({
        title: "Berhasil",
        description: "Keranjang berhasil diperbarui",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memperbarui keranjang",
        variant: "destructive",
      });
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!itemId || itemId === "undefined" || itemId.trim() === "") {
      toast({
        title: "Error",
        description: "Item ID tidak valid",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdatingItem(itemId);
      await removeCartItem(itemId, token || "");

      await fetchCart();
      await fetchRecommendations();

      toast({
        title: "Berhasil",
        description: "Item berhasil dihapus dari keranjang",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menghapus item",
        variant: "destructive",
      });
    } finally {
      setUpdatingItem(null);
    }
  };

  const handleClearCart = async () => {
    if (!confirm("Apakah Anda yakin ingin mengosongkan keranjang?")) {
      return;
    }

    try {
      setClearingCart(true);
      await clearCart(token || "");

      // Update local state
      setCart(prevCart => prevCart ? { ...prevCart, items: [] } : null);
      await fetchRecommendations();
      toast({
        title: "Berhasil",
        description: "Keranjang berhasil dikosongkan",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal mengosongkan keranjang",
        variant: "destructive",
      });
    } finally {
      setClearingCart(false);
    }
  };

  const authModal = (
    <AuthModal open={showAuthModal} onAuthenticated={handleAuthenticated} onClose={() => setShowAuthModal(false)} />
  );

  if (processingPending) {
    return (
      <>
        {authModal}
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3" role="status">
          <Spinner size="lg" aria-hidden />
          <p className="text-sm text-muted-foreground">Menambahkan produk ke keranjang…</p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {authModal}
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-8" role="status" aria-label="Memuat keranjang">
          <Skeleton className="mb-6 h-9 w-48" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            <div className="divide-y divide-border-button-default rounded-3xl border border-border-button-default">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-4 px-4 py-5 sm:px-6">
                  <Skeleton className="size-20 shrink-0 sm:size-24" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-9 w-36" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton className="hidden h-64 rounded-3xl lg:block" />
          </div>
        </div>
      </>
    );
  }

  if (!cart || !cart.items?.length) {
    return (
      <>
        {authModal}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h1 className="mb-6 text-2xl font-extrabold tracking-tight sm:text-3xl">Keranjang</h1>
          <div className="rounded-3xl border border-border-button-default bg-background-full px-6 py-12 text-center">
            <h2 className="text-lg font-bold">
              {isAuthenticated ? "Keranjang Anda masih kosong" : "Masuk untuk melihat keranjang"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {isAuthenticated
                ? "Pilih produk di toko, lalu tekan tombol beli. Produknya akan muncul di sini."
                : "Keranjang tersimpan di akun Anda. Login dengan nomor WhatsApp untuk melanjutkan."}
            </p>
            <div className="mt-6">
              {isAuthenticated ? (
                <Button asChild size="lg">
                  <Link href="https://topsellbelanja.com">Lihat produk</Link>
                </Button>
              ) : (
                <Button size="lg" onClick={() => setShowAuthModal(true)}>Login</Button>
              )}
            </div>
          </div>
          <Recommendations items={recommendations} loading={recoLoading} />
        </div>
      </>
    );
  }

  const selectedCount = getSelectedItemCount();
  const selectedTotal = calculateSelectedTotal();

  return (
    <>
      {authModal}
      <div className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:pb-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h1 className="text-title-1-semibold text-text-primary sm:text-display-4-semibold">
            Keranjang <span className="text-headline-medium text-text-secondary">({cart.items.length})</span>
          </h1>
          <Button variant="outline" size="sm" onClick={handleClearCart} disabled={clearingCart}>
            <Trash2Icon />
            {clearingCart ? "Mengosongkan…" : "Kosongkan"}
          </Button>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <div className="rounded-3xl border border-border-button-default bg-background-full">
            <div className="flex items-center gap-3 border-b border-border-button-default px-4 py-3 sm:px-6">
              <Checkbox isSelected={selectAll} onChange={toggleSelectAll}>
                Pilih semua
              </Checkbox>
            </div>

            <ul className="divide-y divide-border-button-default">
              {cart.items.map((item) => {
                const soldOut = item.stock <= 0;
                const busy = updatingItem === item.id;
                return (
                  <li key={item.id} className={`flex gap-3 px-4 py-5 sm:gap-4 sm:px-6 ${soldOut ? "bg-secondary/50" : ""}`}>
                    <Checkbox
                      aria-label={`Pilih ${item.name}`}
                      isSelected={!!selectedItems[item.id]}
                      onChange={() => toggleItemSelection(item.id)}
                      isDisabled={soldOut}
                      className="mt-1 shrink-0"
                    />

                    <div className={`relative h-20 w-20 shrink-0 sm:h-24 sm:w-24 ${soldOut ? "opacity-60" : ""}`}>
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={getImageSrc(item.images[0])}
                          alt={getImageAlt(item.images[0], item.name)}
                          className="h-full w-full rounded-md border bg-secondary object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-md border bg-secondary text-xs text-muted-foreground">
                          Tanpa foto
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-body-semibold text-text-primary sm:text-headline-semibold">{item.name}</h2>
                      <p className={`mt-1 text-sm font-medium ${soldOut ? "text-destructive" : "text-muted-foreground"}`}>
                        {soldOut ? "Stok habis. Hapus dari keranjang atau tunggu restock." : `Stok tersedia: ${item.stock}`}
                      </p>

                      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                        <NumberField
                          aria-label={`Jumlah ${item.name}`}
                          value={item.qty}
                          minValue={1}
                          maxValue={Math.max(item.stock, item.qty, 1)}
                          isDisabled={!!updatingItem || soldOut}
                          onChange={(value) => {
                            if (Number.isFinite(value) && value !== item.qty) handleUpdateQuantity(item.id, value);
                          }}
                          className="w-36"
                          fieldClassName="min-h-11 md:min-h-9"
                        />

                        <div className="text-right">
                          {item.regularPrice && parseFloat(item.regularPrice) > 0 && (
                            <p className="text-xs text-muted-foreground line-through tabular-nums">
                              {priceToIDR(parseFloat(item.regularPrice) * item.qty)}
                            </p>
                          )}
                          <p className="text-base font-bold tabular-nums sm:text-lg">
                            {priceToIDR(parseFloat(item.price) * item.qty)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          className="-ml-1 inline-flex h-10 items-center gap-1.5 rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                          onClick={() => {
                            if (item.id) {
                              handleRemoveItem(item.id);
                            } else {
                              toast({ title: "Error", description: "Item ID tidak ditemukan", variant: "destructive" });
                            }
                          }}
                          disabled={busy || !item.id}
                        >
                          <Trash2Icon className="h-4 w-4" />
                          Hapus
                        </button>
                        {busy && <Spinner size="xs" aria-label="Memperbarui" />}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <aside aria-label="Ringkasan keranjang" className="hidden rounded-3xl border border-border-button-default bg-background-full p-6 lg:sticky lg:top-6 lg:block">
            <h2 className="text-headline-semibold text-text-primary">Ringkasan</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Barang dipilih</dt>
                <dd className="font-medium tabular-nums">{selectedCount} dari {cart.items.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium tabular-nums">{priceToIDR(selectedTotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ongkos kirim</dt>
                <dd className="text-muted-foreground">Dihitung di checkout</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4">
              <span className="font-bold">Total</span>
              <span className="text-xl font-extrabold tabular-nums">{priceToIDR(selectedTotal)}</span>
            </div>
            <Button size="lg" className="mt-5 w-full font-bold" onClick={handleCheckout} disabled={selectedCount === 0}>
              Lanjut ke Checkout{selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
            {selectedCount === 0 && (
              <p className="mt-2 text-center text-sm text-muted-foreground" role="status">Pilih minimal satu barang</p>
            )}
            <Link href="https://topsellbelanja.com" className="mt-4 block text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Lanjutkan belanja
            </Link>
          </aside>
        </div>

        <Recommendations items={recommendations} loading={recoLoading} />
      </div>

      {/* Phone: total and the way forward stay in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-button-default bg-background-full px-4 pb-safe pt-3 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 pb-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{selectedCount} barang dipilih</p>
            <p className="truncate text-lg font-extrabold tabular-nums">{priceToIDR(selectedTotal)}</p>
          </div>
          <Button size="lg" className="font-bold min-[400px]:shrink-0" onClick={handleCheckout} disabled={selectedCount === 0}>
            Checkout{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </div>
      </div>
    </>
  );
}
