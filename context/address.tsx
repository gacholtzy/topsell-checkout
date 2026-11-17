"use client";

import { toast } from "../hooks/use-toast";
import { AddressArea, Store, PaymentGroup, PaymentMethod } from "../interface/address";
import { useAddressStore } from "../lib/store";
import React from "react";

interface AddressContextType {
    selectedProvince?: string | null;
    selectedCity?: string | null;
    selectedSubdistrict?: string | null;
    selectedPostalCode?: string | null;
    selectedDestinationID?: string | null;
    selectSubdistrict?: (subdistrict: string) => void;
    selectPostalCode?: (postalCode: string) => void;
    selectDestinationID?: (destinationID: string) => void;
    stores: Store[];
    selectedStore?: Store | null;
    setSelectedStore?: (store: Store) => void;
    selectStore?: (store: Store) => void;
    searchStore?: string;
    setSearchStore?: (search: string) => void;

    paymentGroups: PaymentGroup[];
    selectedPaymentMethod?: PaymentMethod | null;
    selectPaymentMethod?: (method: PaymentMethod) => void;

    bankNumber: string;
    setBankNumber: React.Dispatch<React.SetStateAction<string>>;
    bankAccountName: string;
    setBankAccountName: React.Dispatch<React.SetStateAction<string>>;

    isAddressSubmitted: boolean;
    setIsAddressSubmitted: React.Dispatch<React.SetStateAction<boolean>>;

    /** Adopt a district picked from the Biteship search (names + area id). */
    selectAddressArea?: (area: AddressArea) => void;
}

const AddressContext = React.createContext<AddressContextType | null>(null);

export const AddressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [stores, setStores] = React.useState<Store[]>([]);
    const [searchStore, setSearchStore] = React.useState<string>("");

    const [paymentGroups, setPaymentGroups] = React.useState<PaymentGroup[]>([]);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod | null>(null);

    const [selectedProvince, setSelectedProvince] = React.useState<string>("");
    const [selectedCity, setSelectedCity] = React.useState<string>("");
    const [selectedSubdistrict, setSelectedSubdistrict] = React.useState<string>("");
    const [selectedPostalCode, setSelectedPostalCode] = React.useState<string>("");
    const [selectedDestinationID, setSelectedDestinationID] = React.useState<string>("");
    const [selectedStore, setSelectedStore] = React.useState<Store | null>(null);
    const { addressState } = useAddressStore();

    const [bankNumber, setBankNumber] = React.useState<string>("xxxx-xxxx-xxxx-xxxx");
    const [bankAccountName, setBankAccountName] = React.useState<string>("xxxx xxxx"); 
    const [isAddressSubmitted, setIsAddressSubmitted] = React.useState<boolean>(false);

    const fetchStores = async () => {
        try {
            const res = await fetch(`/backend/address/store?search=${searchStore}`);
            const data = await res.json();
            setStores(data.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch stores',
                variant: "destructive"
            })
        }
    }

    const fetchPaymentGroups = async () => {
        try {
            const res = await fetch(`/backend/address/payment`);
            const data = await res.json();
            setPaymentGroups(data.data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to fetch payment groups',
                variant: "destructive"
            })
        }
    }

    const selectSubdistrict = (subdistrict: string) => {
        setSelectedSubdistrict(subdistrict);
    }

    const selectPostalCode = (postalCode: string) => {
        setSelectedPostalCode(postalCode || "");
    }

    const selectDestinationID = (destinationID: string) => {
        setSelectedDestinationID(destinationID);
    }

    const selectStore = (store: Store) => {
        setSelectedStore(store);
    }

    const selectPaymentMethod = (method: PaymentMethod) => {
        setSelectedPaymentMethod(method);
    }

    const selectAddressArea = React.useCallback((area: AddressArea) => {
        setSelectedProvince(area.province || "");
        setSelectedCity(area.city || "");
        setSelectedSubdistrict(area.subdistrict || "");
        setSelectedPostalCode(area.postal_code || "");
        setSelectedDestinationID(area.destinationID || "");
    }, []);

    // The saved address outlives a page load (localStorage) but this context
    // does not, and voucher validation and the branch picker read the
    // destination from here. Adopt the saved address once it is hydrated,
    // unless the customer already picked one in this session.
    React.useEffect(() => {
        if (!addressState || !addressState.destinationID) return;
        if (selectedDestinationID) return;
        selectAddressArea({
            province: addressState.province,
            city: addressState.city,
            subdistrict: addressState.subdistrict,
            postal_code: addressState.postal_code,
            destinationID: addressState.destinationID,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addressState]);

    React.useEffect(() => {
        fetchPaymentGroups();
    }, []);

    React.useEffect(() => {
        fetchStores();
    }, [searchStore]);

    return (
        <AddressContext.Provider value={{
            selectedProvince,
            selectedCity,
            selectedSubdistrict,
            selectedPostalCode,
            selectedDestinationID,
            selectSubdistrict,
            selectPostalCode,
            selectDestinationID,
            stores,
            selectedStore,
            setSelectedStore,
            selectStore,
            searchStore,
            setSearchStore,
            paymentGroups,
            selectedPaymentMethod,
            selectPaymentMethod,
            bankNumber,
            setBankNumber,
            bankAccountName,
            setBankAccountName,
            isAddressSubmitted,
            setIsAddressSubmitted,
            selectAddressArea,
        }}>
            {children}
        </AddressContext.Provider>
    )
}

export const useAddress = () => {
    const context = React.useContext(AddressContext);
    if (!context) {
        throw new Error('useAddress must be used within a AddressProvider');
    }
    return context;
}