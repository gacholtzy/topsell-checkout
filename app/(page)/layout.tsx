import { CartProvider } from "@/context/cart";
import AppHeader from "../../components/header";
import { AddressProvider } from "../../context/address";
import { ShippingProvider } from "../../context/shipping";
import { PickupStockProvider } from "../../context/pickup-stock";
import { VoucherProvider } from "../../context/voucher";
import React, { Suspense } from "react";
import HomeGuard from "@/components/global/HomeGuard";

const StoreLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main>
      <CartProvider>
        <AddressProvider>
          <ShippingProvider>
            <VoucherProvider>
              {/* Sits inside address + shipping + cart: it reacts to the chosen
                  store, the chosen shipping method, and the cart contents. */}
              <PickupStockProvider>
              <AppHeader />
              <Suspense
                fallback={
                  <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                  </div>
                }
              >
                <HomeGuard>{children}</HomeGuard>
              </Suspense>
              </PickupStockProvider>
            </VoucherProvider>
          </ShippingProvider>
        </AddressProvider>
      </CartProvider>
    </main>
  );
};

export default StoreLayout;
