import { Address } from "../interface/address";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AddressStore {
  addressState: Address | null;
  setAddressState: (addressState: Address) => void;
  removeAddressState: () => void;
  getAddresses: () => Address | null;
}

export const useAddressStore = create<AddressStore>()(
  persist(
    (set, get) => ({
      addressState: null,
      setAddressState: (addressState) => set({ addressState }),
      removeAddressState: () => set({ addressState: null }),
      getAddresses: () => get().addressState,
    }),
    {
      name: "address-storage",
      storage: createJSONStorage(() => localStorage),
      // Version 1 held a RajaOngkir destination id. That id means nothing to
      // Biteship, so an older saved address is dropped and the customer picks
      // their district again.
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          return { addressState: null } as AddressStore;
        }
        return persistedState as AddressStore;
      },
    }
  )
);
