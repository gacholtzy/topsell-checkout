"use client";

import { useEffect, useState } from "react";
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
import AuthModal from "@/components/auth-modal";
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

  if (loading || processingPending) {
    return (
      <>
        <AuthModal open={showAuthModal} onAuthenticated={handleAuthenticated} onClose={() => setShowAuthModal(false)} />
        <div className="flex flex-col justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
          {processingPending && (
            <p className="mt-4 text-lg text-gray-600">Menambahkan produk ke keranjang...</p>
          )}
        </div>
      </>
    );
  }

  if (!cart || !cart.items?.length) {
    return (
      <>
        <AuthModal open={showAuthModal} onAuthenticated={handleAuthenticated} onClose={() => setShowAuthModal(false)} />
        <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Keranjang Anda</h1>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center">
          <ShoppingCartIcon className="w-16 h-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {isAuthenticated ? "Keranjang Anda kosong" : "Anda belum login"}
          </h2>
          <p className="text-gray-500 mb-6">
            {isAuthenticated
              ? "Sepertinya Anda belum menambahkan item apapun ke keranjang."
              : "Silakan login terlebih dahulu untuk melihat keranjang belanja Anda."}
          </p>
          {isAuthenticated ? (
            <Link
              href="https://topsellbelanja.com"
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Lanjutkan Belanja
            </Link>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Login
            </button>
          )}
        </div>

        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Rekomendasi Untuk Anda</h2>
          </div>
          {recoLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : recommendations.length > 0 ? (
            <Carousel className="rounded-md overflow-hidden relative">
              <CarouselContent className="[&>div>div]:items-stretch">
                {recommendations.map((p, idx) => (
                  <CarouselItem key={`${p.slug}-${idx}`} className="basis-1/2 md:basis-1/3 lg:basis-1/4 pt-4">
                    <div className="border rounded-lg bg-white h-full flex flex-col relative">
                      {
                        (p.regularPrice && Number(p.regularPrice) > 0) && (p.regularPrice !== p.price) &&
                        <div className="absolute left-0 -top-3 z-[99999]">
                          <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-sm">
                            Hemat {priceToIDR(parseFloat(p.regularPrice) - parseFloat(p.price))}
                          </span>
                        </div>
                      }
                      <div className="aspect-[16/9] bg-gray-100 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumbnail || "/images/placeholder-image.svg"} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 space-y-2 flex flex-col justify-between h-full">
                        <div className="line-clamp-2 font-medium text-sm">{p.name}</div>
                        <div className="flex flex-col items-start gap-2">
                          {(p.regularPrice && Number(p.regularPrice) > 0) && (p.regularPrice !== p.price) && (
                            <span className="text-xs line-through">Rp {Number(p.regularPrice).toLocaleString("id-ID")}</span>
                          )}
                          <span className="font-bold text-red-500">Rp {Number(p.price || 0).toLocaleString("id-ID")}</span>
                        </div>
                        <div className="mt-auto pt-2">
                          <Link
                            href={`https://topsellbelanja.com/product/${p.slug}`}
                            target="_blank"
                            className="inline-flex items-center justify-center w-full py-2 px-3 bg-[#03445f] text-white text-sm rounded hover:bg-[#03445f]"
                          >
                            Info Pemesanan
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {recommendations.length > 1 && (
                <>
                  <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black text-white hover:text-white rounded-full p-2 hover:bg-black/80 hidden lg:block" />
                  <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black text-white hover:text-white rounded-full p-2 hover:bg-black/80 hidden lg:block" />
                </>
              )}
            </Carousel>
          ) : (
            <div className="text-sm text-gray-500">Tidak ada rekomendasi saat ini.</div>
          )}
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <AuthModal open={showAuthModal} onAuthenticated={handleAuthenticated} onClose={() => setShowAuthModal(false)} />
    <div className="container mx-auto px-4 py-8">
      <div className="flex md:flex-row flex-col justify-between md:items-center mb-6">
        <h1 className="text-2xl font-bold">Keranjang Anda</h1>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 text-red-600 border border-red-600 rounded-md hover:bg-red-50 flex items-center transition-colors duration-200 md:mt-0 mt-4"
            onClick={handleClearCart}
            disabled={clearingCart}
          >
            <Trash2Icon className="w-4 h-4 mr-2" />
            Kosongkan Keranjang
            {clearingCart && (
              <div className="ml-2 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600"></div>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 order-1 lg:order-1">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-semibold">Item ({cart.items.length})</h2>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectAll}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 mr-2 cursor-pointer accent-primary rounded"
                />
                <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">Pilih Semua</label>
              </div>
            </div>

            <div>
              {cart.items.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-5 ${index < cart.items.length - 1 ? 'border-b' : ''} 
                    ${item.stock <= 0 ? 'bg-gray-50' : 'hover:bg-gray-50'} 
                    transition-colors duration-200 ease-in-out`}
                >
                  <div className="flex items-start">
                    <div className="flex items-center mr-4 pt-2">
                      <input
                        type="checkbox"
                        id={`item-${item.id}`}
                        checked={!!selectedItems[item.id]}
                        onChange={() => toggleItemSelection(item.id)}
                        disabled={item.stock <= 0}
                        className={`w-5 h-5 cursor-pointer accent-primary rounded
                          ${item.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div className="flex-shrink-0 w-16 h-16 md:w-28 md:h-28 mr-5 relative overflow-hidden rounded-lg">
                      {item.images && item.images.length > 0 ? (
                        <img
                          src={getImageSrc(item.images[0])}
                          alt={getImageAlt(item.images[0], item.name)}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400">Tidak Ada Gambar</span>
                        </div>
                      )}
                      {item.stock <= 0 && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="bg-red-500 text-white px-3 py-1.5 text-xs font-bold rounded-full">Stock Habis</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-sm md:text-lg">{item.name}</h3>
                        </div>
                        <button
                          className={`text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200`}
                          onClick={() => {
                            if (item.id) {
                              handleRemoveItem(item.id);
                            } else {
                              toast({
                                title: "Error",
                                description: "Item ID tidak ditemukan",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={updatingItem === item.id || !item.id}
                        >
                          <Trash2Icon className="w-5 h-5" />
                        </button>
                      </div>

                      {item.stock <= 0 ? (
                        <p className="text-red-500 text-sm font-semibold mt-2 inline-block px-2 py-1 bg-red-50 rounded-md">Stok Habis</p>
                      ) : (
                        <p className="text-green-600 text-sm mt-2 inline-block px-2 py-1 bg-green-50 rounded-md">Stok: {item.stock}</p>
                      )}

                      <div className="mt-4 flex justify-between items-center md:flex-row flex-col-reverse">
                        <div className="flex items-center md:mt-0 mt-4">
                          <button
                            className={`w-8 h-8 flex items-center justify-center rounded-md border ${item.qty <= 1 ? 'bg-gray-100 text-gray-400' : 'hover:bg-gray-100'} transition-colors duration-200 ${item.stock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleUpdateQuantity(item.id, item.qty - 1)}
                            disabled={!!updatingItem || item.stock <= 0 || item.qty <= 1}
                          >
                            <MinusIcon className="w-4 h-4" />
                          </button>
                          <div className="mx-3 px-3 py-1 border rounded-md w-12 text-center">
                            {item.qty}
                          </div>
                          <button
                            className={`w-8 h-8 flex items-center justify-center rounded-md border hover:bg-gray-100 transition-colors duration-200 ${item.stock <= 0 || item.qty >= item.stock ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => handleUpdateQuantity(item.id, item.qty + 1)}
                            disabled={!!updatingItem || item.stock <= 0 || item.qty >= item.stock}
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-lg">
                            {priceToIDR(parseFloat(item.price) * item.qty)}
                          </p>
                          {item.regularPrice && parseFloat(item.regularPrice) > 0 && (
                            <p className="text-sm text-gray-500 line-through">
                              {priceToIDR(parseFloat(item.regularPrice) * item.qty)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {updatingItem === item.id && (
                      <div className="ml-2 animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-only Recommendations inside grid above summary */}
        <div className="order-2 md:hidden">
          <div className="mt-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Rekomendasi Untuk Anda</h2>
            </div>
            {recoLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : recommendations.length > 0 ? (
              <Carousel className="rounded-md overflow-hidden relative">
              <CarouselContent className="[&>div>div]:items-stretch">
                {recommendations.map((p, idx) => (
                  <CarouselItem key={`${p.slug}-${idx}`} className="basis-1/2 md:basis-1/3 lg:basis-1/4 pt-4">
                    <div className="border rounded-lg bg-white h-full flex flex-col relative">
                      {
                        (p.regularPrice && Number(p.regularPrice) > 0) && (p.regularPrice !== p.price) &&
                        <div className="absolute left-0 -top-3 z-[99999]">
                          <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-sm">
                            Hemat {priceToIDR(parseFloat(p.regularPrice) - parseFloat(p.price))}
                          </span>
                        </div>
                      }
                      <div className="aspect-[16/9] bg-gray-100 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumbnail || "/images/placeholder-image.svg"} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 space-y-2 flex flex-col justify-between h-full">
                        <div className="line-clamp-2 font-medium text-sm">{p.name}</div>
                        <div className="flex flex-col items-start gap-2">
                          {(p.regularPrice && Number(p.regularPrice) > 0) && (p.regularPrice !== p.price) && (
                            <span className="text-xs line-through">Rp {Number(p.regularPrice).toLocaleString("id-ID")}</span>
                          )}
                          <span className="font-bold text-red-500">Rp {Number(p.price || 0).toLocaleString("id-ID")}</span>
                        </div>
                        <div className="mt-auto pt-2">
                          <Link
                            href={`https://topsellbelanja.com/product/${p.slug}`}
                            target="_blank"
                            className="inline-flex items-center justify-center w-full py-2 px-3 bg-[#03445f] text-white text-sm rounded hover:bg-[#03445f]"
                          >
                            Info Pemesanan
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {recommendations.length > 1 && (
                <>
                  <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black text-white hover:text-white rounded-full p-2 hover:bg-black/80 hidden lg:block" />
                  <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black text-white hover:text-white rounded-full p-2 hover:bg-black/80 hidden lg:block" />
                </>
              )}
            </Carousel>
            ) : (
              <div className="text-sm text-gray-500">Tidak ada rekomendasi saat ini.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 order-3 lg:order-2">
          <div className="bg-white rounded-lg shadow p-6 lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold mb-4">Ringkasan Pesanan</h2>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Item Terpilih</span>
                <span>{getSelectedItemCount()} / {cart.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{priceToIDR(calculateSelectedTotal())}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Pengiriman</span>
                <span>Dihitung saat checkout</span>
              </div>
              <hr className="my-4" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{priceToIDR(calculateSelectedTotal())}</span>
              </div>
            </div>

            <button
              className="w-full mt-6 py-3 px-4 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center justify-center"
              onClick={handleCheckout}
              disabled={getSelectedItemCount() === 0}
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Checkout ({getSelectedItemCount()} Item)
            </button>

            <Link
              href="https://topsellbelanja.com"
              className="block w-full mt-4 py-2 px-4 text-center text-gray-600 hover:text-gray-800"
            >
              Lanjutkan Belanja
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop-only recommendations placed after grid so sticky summary stops before this section */}
      <div className="mt-10 hidden md:block">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Rekomendasi Untuk Anda</h2>
        </div>
        {recoLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : recommendations.length > 0 ? (
          <Carousel className="rounded-md overflow-hidden relative">
              <CarouselContent className="[&>div>div]:items-stretch">
                {recommendations.map((p, idx) => (
                  <CarouselItem key={`${p.slug}-${idx}`} className="basis-1/2 md:basis-1/3 lg:basis-1/4 pt-4">
                    <div className="border rounded-lg bg-white h-full flex flex-col relative">
                      {
                        (p.regularPrice && Number(p.regularPrice) > 0) && (p.regularPrice !== p.price) &&
                        <div className="absolute left-0 -top-3 z-[99999]">
                          <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full shadow-sm">
                            Hemat {priceToIDR(parseFloat(p.regularPrice) - parseFloat(p.price))}
                          </span>
                        </div>
                      }
                      <div className="aspect-[16/9] bg-gray-100 flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumbnail || "/images/placeholder-image.svg"} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 space-y-2 flex flex-col justify-between h-full">
                        <div className="line-clamp-2 font-medium text-sm">{p.name}</div>
                        <div className="flex flex-col items-start gap-2">
                          {(p.regularPrice && Number(p.regularPrice) > 0) && (p.regularPrice !== p.price) && (
                            <span className="text-xs line-through">Rp {Number(p.regularPrice).toLocaleString("id-ID")}</span>
                          )}
                          <span className="font-bold text-red-500">Rp {Number(p.price || 0).toLocaleString("id-ID")}</span>
                        </div>
                        <div className="mt-auto pt-2">
                          <Link
                            href={`https://topsellbelanja.com/product/${p.slug}`}
                            target="_blank"
                            className="inline-flex items-center justify-center w-full py-2 px-3 bg-[#03445f] text-white text-sm rounded hover:bg-[#03445f]"
                          >
                            Info Pemesanan
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {recommendations.length > 1 && (
                <>
                  <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black text-white hover:text-white rounded-full p-2 hover:bg-black/80 hidden lg:block" />
                  <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black text-white hover:text-white rounded-full p-2 hover:bg-black/80 hidden lg:block" />
                </>
              )}
            </Carousel>
        ) : (
          <div className="text-sm text-gray-500">Tidak ada rekomendasi saat ini.</div>
        )}
      </div>
    </div>
    </>
  );
}
