"use client"
import React from 'react'
import { Button } from './ui/button'
import { ChevronRightIcon, ChevronsUpDownIcon } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { useShipping } from '../context/shipping'
import parse from 'html-react-parser'
import { Card, CardContent } from './ui/card'
import { Separator } from './ui/separator'
import AddressModal from './address-modal'
import { useAddress } from '../context/address'
import { priceToIDR } from '../lib/helper'
import { useAddressStore } from '../lib/store'
import PickupStockNotice from './pickup-stock-notice'
import CourierOptions from './courier-options'
import { shippingOptionDuration, shippingOptionLabel } from '../interface/shipping'

const ShippingOption = () => {
    const [open, setOpen] = React.useState(false)
    const [openDialog, setOpenDialog] = React.useState(false)
    // Set when the customer asks to change shop from the stock warning, so the
    // address modal hands them straight to the branch picker.
    const [jumpToArea, setJumpToArea] = React.useState(false)
    const [isWithinTopsellArea, setIsWithinTopsellArea] = React.useState(false)
    const { shippingMethods, selectedShippingMethod, selectShippingMethod, shippingCost, shippingCostLoading, selectedShippingOption } = useShipping()

    // What the collapsed header says about a delivery: the picked courier and
    // its price, so "Pengiriman Reguler" never stands alone as the only clue.
    const deliverySummary = () => {
        if (shippingCostLoading) return " - Menghitung Ongkos Kirim..."
        const price = shippingCost && shippingCost > 0 ? priceToIDR(shippingCost) : "GRATIS ONGKIR!"
        if (selectedShippingOption) {
            const eta = shippingOptionDuration(selectedShippingOption)
            return ` - ${shippingOptionLabel(selectedShippingOption)}${eta ? ` (${eta})` : ''} - ${price}`
        }
        return ` - ${price}`
    }
    const { selectedStore, isAddressSubmitted } = useAddress()
    const { getAddresses } = useAddressStore()


    const validatePostalCode = async (postalCode: string) => {
        const res = await fetch(`/backend/topsell-area-postal/check-postal-code-is-exist/${postalCode}`);
        const data = await res.json();
        setIsWithinTopsellArea(data.data);
    }

    React.useEffect(() => {
        const fetchData = async () => {
            const address = getAddresses();
            if (address) {
                const postalCode = address.postal_code;
                validatePostalCode(postalCode);
            }
        }
        fetchData();
    }, [getAddresses()]);

    // Check if address is within Topsell area
    // const isWithinTopsellArea = React.useMemo(async () => {
    //     const address = getAddresses();
    //     if (!address) return null;

    //     const postalCode = address.postal_code;
    //     const isExist = await validatePostalCode(postalCode);
    //     if (isExist) {
    //         return true;
    //     }
    //     return false;

    //     // const areaSupportCityIds = ["289", "290", "178", "179", "492", "255", "256", "133", "409", "164"];
    //     // return areaSupportCityIds.includes(address.city.city_id);
    // }, [getAddresses()]);

    return (
        <>
            <Collapsible
                open={open}
                onOpenChange={setOpen}
            >
                <CollapsibleTrigger className='w-full flex justify-between items-center border rounded-md p-4 border-slate-300 text-left'>
                    {selectedShippingMethod ?
                        selectedStore && selectedShippingMethod.title === "Ambil di Toko" ?
                            `${selectedShippingMethod.title} - ${selectedStore.name} - ${selectedStore.storeArea.name}`
                            : selectedShippingMethod.title + deliverySummary()
                        :
                        "Pilih Metode Pengiriman"}
                    <ChevronsUpDownIcon className='w-6 h-6' />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    {shippingMethods
                        .filter(method => {
                            const address = getAddresses();
                            if (!address && isAddressSubmitted) {
                                // If no address, only show "Ambil di Toko" and "Diantar ke Alamat"
                                return method.title !== "Pengiriman Reguler";
                            }

                            // If address is within Topsell area, hide "Pengiriman Reguler"
                            if (isWithinTopsellArea && isAddressSubmitted) {
                                if (shippingCost !== null && shippingCost > 0) {
                                    // Postal is in Topsell area, but shipping is not free (e.g. electronic rules).
                                    // Keep regular shipping and store pickup, hide free-delivery option.
                                    return method.title !== "Diantar ke Alamat";
                                }
                                return method.title !== "Pengiriman Reguler";
                            }
                            // return all method if address is not submitted
                            if (!isAddressSubmitted) {
                                return method.title !== "Pengiriman Reguler";
                            }
                            // // If address is outside Topsell area, only show "Pengiriman Reguler"
                            return method.title === "Pengiriman Reguler";
                        })
                        .map((method, index) => (
                            <div key={index} className='border-slate-300 p-4 cursor-pointer'
                                onClick={() => {
                                    if (selectShippingMethod) selectShippingMethod(method);
                                    setOpen(false)
                                    setOpenDialog(true)
                                }}
                            >
                                <h3 className='text-lg font-semibold'>{method.title} {
                                    method.title === "Ambil di Toko" ?
                                        selectedStore?.name ? "- " + selectedStore?.name : ""
                                        :
                                        method.title === "Diantar ke Alamat" ? (shippingCost && shippingCost > 0 ? `- ${priceToIDR(shippingCost || 0)}` : " - GRATIS ONGKIR!") :
                                            selectedShippingMethod ? (shippingCostLoading ? " - Menghitung Ongkos Kirim..." : shippingCost && shippingCost > 0 ? `- ${priceToIDR(shippingCost || 0)}` : " - GRATIS ONGKIR!") : ""
                                }</h3>
                                <p className='text-sm mb-6'>{parse(method.description)}</p>
                                {
                                    shippingMethods.length - 1 !== index && <Separator />
                                }
                            </div>
                        ))
                    }
                </CollapsibleContent>
            </Collapsible >
            {/* Courier picker for deliveries, once an address is saved. Each row is
                one Biteship service that is switched on in the dashboard. */}
            {selectedShippingMethod && selectedShippingMethod.title !== "Ambil di Toko" && isAddressSubmitted && (
                <CourierOptions />
            )}
            {/* Live branch stock, shown as soon as a shop is chosen so the
                customer learns about a shortage here rather than at payment. */}
            {selectedShippingMethod?.title === "Ambil di Toko" && selectedStore && (
                <div className='mt-3'>
                    <PickupStockNotice
                        onChooseBranch={() => {
                            setJumpToArea(true)
                            setOpenDialog(true)
                        }}
                    />
                </div>
            )}
            <AddressModal
                open={openDialog}
                jumpToArea={jumpToArea}
                onOpenChange={(next) => {
                    setOpenDialog(next)
                    // Clear the shortcut once used, so opening the modal the
                    // normal way still starts at the address step.
                    if (!next) setJumpToArea(false)
                }}
            />
        </>
    )
}

export default ShippingOption