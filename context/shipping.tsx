"use client";

import { toast } from "../hooks/use-toast";
import { ShippingMethod, ShippingOption } from "../interface/shipping";
import { ShippingDestinationInput } from "../interface/address";
import { ProductIDSAndQuantity } from "../interface/product";
import React from 'react'

interface ShippingContextType {
    shippingMethods: ShippingMethod[];
    selectedShippingMethod?: ShippingMethod | null;
    selectShippingMethod?: (method: ShippingMethod) => void;
    shippingCost: number | null;
    setShippingCost: (cost: number) => void;
    shippingCostLoading: boolean;
    setShippingCostLoading: (loading: boolean) => void;
    /** Courier services quoted for the current address and cart, cheapest first. */
    shippingOptions: ShippingOption[];
    shippingOptionsLoading: boolean;
    shippingOptionsError: string | null;
    /** The service the customer picked; its price is `shippingCost`. */
    selectedShippingOption: ShippingOption | null;
    selectShippingOption: (option: ShippingOption) => void;
    /**
     * Quote every courier for `dest` and the cart, keep the customer's pick if it
     * is still offered (else the cheapest), and return the picked price. null
     * when the quote failed.
     */
    fetchShippingOptions: (dest: ShippingDestinationInput, products: ProductIDSAndQuantity[]) => Promise<number | null>;
    clearShippingOptions: () => void;
}

const ShippingContext = React.createContext<ShippingContextType | null>(null)

const sameOption = (a: ShippingOption | null, b: ShippingOption) =>
    !!a && a.courierCode === b.courierCode && a.courierServiceCode === b.courierServiceCode;

export const ShippingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [shippingMethods, setShippingMethods] = React.useState<ShippingMethod[]>([]);
    const [selectedShippingMethod, setSelectedShippingMethod] = React.useState<ShippingMethod | null>(null);
    const [shippingCost, setShippingCost] = React.useState<number | null>(null);
    const [shippingCostLoading, setShippingCostLoading] = React.useState<boolean>(false);
    const [shippingOptions, setShippingOptions] = React.useState<ShippingOption[]>([]);
    const [shippingOptionsLoading, setShippingOptionsLoading] = React.useState<boolean>(false);
    const [shippingOptionsError, setShippingOptionsError] = React.useState<string | null>(null);
    const [selectedShippingOption, setSelectedShippingOption] = React.useState<ShippingOption | null>(null);
    // The pick survives a re-quote (new address, changed cart) so the customer is
    // not silently moved to another courier; read via a ref inside the fetch.
    const selectedRef = React.useRef<ShippingOption | null>(null);
    selectedRef.current = selectedShippingOption;

    const fetchShippingMethods = async () => {
        try {
            const res = await fetch(`/backend/shippings/methods`);
            const data = await res.json();
            setShippingMethods(data.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch shipping methods',
                variant: "destructive"
            })
        }
    }

    const selectShippingMethod = (method: ShippingMethod) => {
        setSelectedShippingMethod(method);
    }

    const selectShippingOption = React.useCallback((option: ShippingOption) => {
        setSelectedShippingOption(option);
        setShippingCost(option.price);
    }, []);

    const clearShippingOptions = React.useCallback(() => {
        setShippingOptions([]);
        setSelectedShippingOption(null);
        setShippingOptionsError(null);
    }, []);

    const fetchShippingOptions = React.useCallback(async (dest: ShippingDestinationInput, products: ProductIDSAndQuantity[]): Promise<number | null> => {
        setShippingOptionsLoading(true);
        setShippingCostLoading(true);
        setShippingOptionsError(null);
        try {
            const query = new URLSearchParams({
                destination: dest.destinationID || '',
                postal_code: dest.postalCode || '',
            });
            const res = await fetch(`/backend/shippings/options?${query.toString()}`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_ids_and_quantities: products }),
            });
            const data = await res.json();
            if (!res.ok || !Array.isArray(data?.data)) {
                throw new Error(data?.message || 'shipping options failed');
            }
            const options: ShippingOption[] = data.data;
            setShippingOptions(options);
            if (options.length === 0) {
                setSelectedShippingOption(null);
                setShippingOptionsError('Tidak ada kurir yang melayani alamat ini.');
                return null;
            }
            const kept = options.find((o) => sameOption(selectedRef.current, o)) || options[0];
            setSelectedShippingOption(kept);
            setShippingCost(kept.price);
            return kept.price;
        } catch (error) {
            console.error('shipping options failed', error);
            setShippingOptions([]);
            setSelectedShippingOption(null);
            setShippingOptionsError('Gagal mengambil pilihan kurir. Coba pilih alamat lagi.');
            toast({
                title: 'Error',
                description: 'Gagal menghitung ongkos kirim. Coba pilih alamat lagi.',
                variant: "destructive"
            })
            return null;
        } finally {
            setShippingOptionsLoading(false);
            setShippingCostLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchShippingMethods();
    }, []);

    return (
        <ShippingContext.Provider value={{
            shippingMethods,
            selectedShippingMethod,
            selectShippingMethod,
            shippingCost,
            setShippingCost,
            shippingCostLoading,
            setShippingCostLoading,
            shippingOptions,
            shippingOptionsLoading,
            shippingOptionsError,
            selectedShippingOption,
            selectShippingOption,
            fetchShippingOptions,
            clearShippingOptions,
        }}>
            {children}
        </ShippingContext.Provider>
    )
}

export const useShipping = () => {
    const context = React.useContext(ShippingContext);
    if (!context) {
        throw new Error('useShipping must be used within a ShippingProvider');
    }
    return context;
}
