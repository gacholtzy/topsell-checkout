"use client";
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ChevronRightIcon } from 'lucide-react';
import { useAddress } from '../context/address';
import { PaymentGroup } from '../interface/address';
import { Separator } from './ui/separator';
import { useShipping } from '../context/shipping';
import { Button } from './ui/button';
import { useGlobalDialog } from './global/useGlobalDialog';
import { usePickupStock } from '../context/pickup-stock';
import { useCart } from '../context/cart';

const PaymentOption = () => {
    const [open, setOpen] = React.useState(false)
    const { paymentGroups, selectPaymentMethod, selectedPaymentMethod, selectedStore, isAddressSubmitted } = useAddress()
    const { selectedShippingMethod } = useShipping()
    const { showAlertDialog } = useGlobalDialog()
    const { canCheckout: stockAllowsCheckout, stock, loading: stockLoading, error: stockError } = usePickupStock()
    const { checkoutLines } = useCart()

    // Check if payment button should be enabled
    const isPaymentButtonEnabled = React.useMemo(() => {
        // Must have address submitted and shipping method selected
        if (!isAddressSubmitted || !selectedShippingMethod) {
            return false;
        }

        // For pickup orders, also need store selected — and the branch has to
        // actually have the goods. Letting payment open on a shop that cannot
        // fill the basket sends the customer on a wasted trip.
        if (selectedShippingMethod.title === "Ambil di Toko") {
            return !!selectedStore && stockAllowsCheckout;
        }

        // For other shipping methods, just need address and shipping method
        return true;
    }, [isAddressSubmitted, selectedShippingMethod, selectedStore, stockAllowsCheckout]);

    // Add effect to clear selected payment method when shipping method changes
    React.useEffect(() => {
        if (selectedShippingMethod?.title !== "Ambil di Toko" && selectedPaymentMethod && selectedPaymentMethod.key == "cc") {
            selectPaymentMethod?.(null as any);
        }
    }, [selectedShippingMethod, selectPaymentMethod]);

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={setOpen}
            >
                {/* <Button className='w-full'> */}
                <Button variant="outline"
                    disabled={!isPaymentButtonEnabled}
                    onClick={() => {
                        if (isPaymentButtonEnabled) {
                            setOpen(true)
                        } else {
                            // Show appropriate message based on what's missing
                            let message = "Pilih metode pengiriman terlebih dahulu";
                            
                            if (selectedShippingMethod && !isAddressSubmitted) {
                                message = "Lengkapi alamat pengiriman terlebih dahulu";
                            } else if (selectedShippingMethod?.title === "Ambil di Toko" && !selectedStore) {
                                message = "Pilih area toko terlebih dahulu";
                            } else if (selectedShippingMethod?.title === "Ambil di Toko" && checkoutLines.length === 0) {
                                message = "Semua barang dikeluarkan dari pesanan. Masukkan kembali barang di daftar produk atau pilih cabang lain.";
                            } else if (selectedShippingMethod?.title === "Ambil di Toko" && stockLoading) {
                                message = "Sedang mengecek ketersediaan barang di toko, mohon tunggu sebentar";
                            } else if (selectedShippingMethod?.title === "Ambil di Toko" && stockError) {
                                message = stockError;
                            } else if (selectedShippingMethod?.title === "Ambil di Toko" && stock && !stock.canCheckout) {
                                message = stock.message;
                            }
                            
                            showAlertDialog({
                                title: "Info",
                                message: message,
                                iconType: "info"
                            })
                        }
                    }}
                    className='w-full flex justify-between items-center border rounded-md p-4 border-slate-300 h-16 text-base'>
                    {selectedPaymentMethod ? <div
                        className='flex items-center max-w-[80%]'
                    >
                        <img src={selectedPaymentMethod.icon} alt={selectedPaymentMethod.name} className='w-8 mr-2 flex-shrink-0' />
                        <h3 className='font-semibold truncate'>{selectedPaymentMethod.name}</h3>
                    </div> : "Pilih Metode Pembayaran"}
                    <ChevronRightIcon className='w-6 h-6 flex-shrink-0' />
                </Button>
                {/* </Button> */}
                <DialogContent className='overflow-y-auto max-h-[calc(100vh-4rem)]'>
                    <DialogHeader>
                        <DialogTitle className="text-center text-2xl font-black">
                            Pilih Metode Pembayaran
                        </DialogTitle>
                    </DialogHeader>
                    {
                        paymentGroups.map((group: PaymentGroup, index) => (
                            <div key={`${index}-12`}>
                                <h3 className='text-lg font-semibold'>{group.name}</h3>
                                {
                                    group.paymentMethods
                                        .filter(method => {
                                            // If shipping method is not "Ambil di Toko", hide cash/debit/credit card payment methods
                                            if (selectedShippingMethod?.title !== "Ambil di Toko") {
                                                return !["cc"].includes(method.key);
                                            }
                                            return true;
                                        })
                                        .map((method, idx) => (
                                            <div className='space-y-6' key={idx}>
                                                <div className='flex items-center gap-4 mt-4 cursor-pointer'
                                                    onClick={() => {
                                                        if (selectPaymentMethod) {
                                                            selectPaymentMethod(method)
                                                            setOpen(false)
                                                        }
                                                    }}
                                                >
                                                    <img src={method.icon} alt={method.name} className='w-12' />
                                                    <div className='w-full'>
                                                        <h3 className='text-sm font-semibold truncated'>{method.name} ({method.excerpt})</h3>
                                                        <p className='text-[10px]'>{method.description}</p>
                                                    </div>
                                                    <div className='w-auto flex justify-end'>
                                                        <ChevronRightIcon className='w-4 h-4' />
                                                    </div>
                                                </div>
                                                <Separator />
                                            </div>
                                        ))
                                }
                            </div>
                        ))
                    }
                </DialogContent>
            </Dialog>
            {/* {
                selectedPaymentMethod && selectedPaymentMethod.key == "manual" && (
                    <div className='space-y-4 my-6'>
                        <div className='space-y-2'>
                            <h4 className='text-sm text-slate-600'>
                                No. Rekening Anda
                            </h4>
                            <Input type='text' placeholder='No. Rekening' value={bankNumber} onChange={(e) => {
                                // tidak menerima input selain angka dan maksimal 20 angka
                                if (!/^\d*$/.test(e.target.value) || e.target.value.length > 20) {
                                    return
                                }
                                setBankNumber(e.target.value)
                            }} />
                        </div>
                        <div className='space-y-2'>
                            <h4 className='text-sm text-slate-600'>
                                Nama Pemilik Rekening
                            </h4>
                            <Input type='text' placeholder='Nama Pemilik Rekening' value={bankAccountName} onChange={(e) => {
                                // hanya menerima huruf dan spasi (nama yang sebenarnya)
                                if (!/^[a-zA-Z\s]*$/.test(e.target.value)) {
                                    return
                                }
                                setBankAccountName(e.target.value)
                            }} />
                        </div>
                    </div>
                )
            } */}
        </>
    )
}

export default PaymentOption