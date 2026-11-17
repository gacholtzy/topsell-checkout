"use client";
import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useVoucher } from '../context/voucher';
import { TicketIcon, ChevronRightIcon, TimerIcon } from 'lucide-react';
import { Voucher } from '../interface/voucher';
import { Button } from './ui/button';
import { dateStringToLocale, priceToIDR } from '../lib/helper';
import { voucherDiscountLabel, voucherEndDate, voucherScopeLabel } from '../lib/voucher-display';
import { useAddress } from '../context/address';
import { toast } from '../hooks/use-toast';
import { useGlobalDialog } from './global/useGlobalDialog';
import { Badge } from './ui/badge';

const VoucherCountdown = ({ endDate }: { endDate: string }) => {
    const [timeLeft, setTimeLeft] = React.useState<string>("");

    React.useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const end = new Date(endDate).getTime();
            const difference = end - now;

            if (difference <= 0) {
                setTimeLeft("Expired");
                return;
            }

            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            setTimeLeft(`00:${minutes}:${seconds}`);
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft();

        return () => clearInterval(timer);
    }, [endDate]);

    return timeLeft;
};

// Format raw "RpXXXXX" patterns in text to proper currency format
const formatCurrencyInText = (text: string): string => {
    return text.replace(/Rp(\d+)/g, (_, amount) => priceToIDR(parseInt(amount)));
};

const PickVoucher = () => {
    const [open, setOpen] = React.useState(false)
    const { vouchers, selectVoucher, selectedVoucher, shippingVouchers, selectShippingVoucher, selectedShippingVoucher, voucherLoading } = useVoucher()
    const { selectedPaymentMethod } = useAddress()
    const { showAlertDialog } = useGlobalDialog()

    const isExpiringSoon = (endDate: string) => {
        if (vouchers.length > 0) {
            const now = new Date().getTime();
            const end = new Date(endDate).getTime();
            const difference = end - now;
            return difference <= 3600000; // 1 hour in milliseconds
        }
        return false
    };

    // Check if there's a non-cancellable auto-apply voucher selected
    const hasNonCancellableAutoApplyVoucher = selectedVoucher?.isAutoApply && !selectedVoucher?.isCancellable
    const hasNonCancellableAutoApplyShippingVoucher = selectedShippingVoucher?.isAutoApply && !selectedShippingVoucher?.isCancellable

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={setOpen}
            >
                {!voucherLoading ? (<div
                    onClick={
                        () => {
                            if (selectedPaymentMethod) {
                                setOpen(true)
                            } else {
                                showAlertDialog({
                                    title: "Info",
                                    message: "Pilih metode pembayaran terlebih dahulu",
                                    iconType: "info"
                                })
                            }
                        }
                    }
                    className='cursor-pointer w-full h-20 border border-gray-300 flex rounded-md p-4 items-center text-lg font-semibold justify-between'>
                    <div className="flex items-center">
                        <TicketIcon className='w-12 h-12 mr-4 text-red-500' />
                        {
                            selectedVoucher && selectedShippingVoucher ? (
                                <div className='flex items-start flex-col'>
                                    <div className='text-xl  font-semibold'>{selectedVoucher.name}</div>
                                    <div className='text-xl  font-semibold'>{selectedShippingVoucher.name}</div>
                                </div>
                            ) : selectedVoucher ? (
                                selectedVoucher.name
                            ) : selectedShippingVoucher ? (
                                selectedShippingVoucher.name
                            ) : (
                                'Pilih Voucher'
                            )
                        }
                    </div>
                    <ChevronRightIcon className="w-6 h-6" />
                </div>) : (
                    <div className='w-full h-20 border border-gray-300 flex rounded-md p-4 items-center text-lg font-semibold justify-between'>
                        <div className="flex items-center">
                            <TicketIcon className='w-12 h-12 mr-4 text-red-500' />
                            <div className='flex items-center'>
                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span className='ml-2'>Loading...</span>
                            </div>
                        </div>
                    </div>
                )}
                <DialogContent className='overflow-y-auto max-h-[calc(100vh-100px)]'>
                    <DialogHeader>
                        <DialogTitle>Pilih Voucher</DialogTitle>
                    </DialogHeader>
                    {
                        vouchers.length < 1 && shippingVouchers.length < 1 ? (
                            <div>
                                Tidak ada voucher yang tersedia
                            </div>
                        ) : (
                            <div>
                                {
                                    vouchers.length > 0 && (
                                        <h4 className='text-lg font-semibold'>Voucher yang tersedia</h4>
                                    )
                                }
                                {
                                    vouchers.map((voucher: Voucher) => (
                                        <div key={voucher.id}>
                                            <div className={`rounded-md p-4 mt-4 w-full transition-all ${
                                                !voucher.isEligible 
                                                    ? 'bg-gray-300 opacity-60 cursor-not-allowed' 
                                                    : selectedVoucher?.id === voucher.id 
                                                        ? 'bg-red-100' 
                                                        : 'bg-red-600'
                                            }`}>

                                                <div className='grid grid-cols-12 gap-4'>
                                                    <div className={`col-span-10 ${
                                                        !voucher.isEligible 
                                                            ? 'text-gray-500' 
                                                            : selectedVoucher?.id !== voucher.id 
                                                                ? 'text-white' 
                                                                : 'text-red-500'
                                                    }`}>
                                                        <div className='text-xl font-semibold'>{voucher.name}</div>
                                                        {!voucher.isEligible && voucher.ineligibleReason && (
                                                            <div className='text-xs font-medium mt-1 mb-1 text-gray-600 bg-gray-200 rounded px-2 py-0.5 inline-block'>
                                                                {formatCurrencyInText(voucher.ineligibleReason)}
                                                            </div>
                                                        )}
                                                        {selectedVoucher?.id === voucher.id && voucher.isAutoApply && !voucher.isCancellable && (
                                                            <div className='text-xs font-medium mt-1 mb-1 opacity-80'>
                                                                Voucher tidak bisa dibatalkan
                                                            </div>
                                                        )}
                                                        <div className='text-xs mt-1 space-y-0.5'>
                                                            {voucher.discount > 0 && (
                                                                <div>Diskon: {voucherDiscountLabel(voucher)}</div>
                                                            )}
                                                            {voucher.minTransaction > 0 && (
                                                                <div>Min. transaksi: {priceToIDR(voucher.minTransaction)}</div>
                                                            )}
                                                        </div>
                                                        {voucherScopeLabel(voucher) && (
                                                            <div className='text-xs font-semibold mt-1 inline-block rounded border border-current px-2 py-0.5'>
                                                                {voucherScopeLabel(voucher)}
                                                            </div>
                                                        )}
                                                        <p className='break-words text-sm line-clamp-2 w-5/6'>{voucher.description}</p>
                                                        <div className='text-xs'>Berlaku hingga {dateStringToLocale(voucherEndDate(voucher))}</div>
                                                    </div>
                                                    <div className='col-span-2 flex items-center justify-end'>
                                                        {!voucher.isEligible ? null : selectedVoucher?.id === voucher.id && voucher.isAutoApply && !voucher.isCancellable ? null : (
                                                            <Button 
                                                                variant="destructive" 
                                                                className='border border-white bg-red-600'
                                                                disabled={!voucher.isEligible || (hasNonCancellableAutoApplyVoucher && selectedVoucher?.id !== voucher.id)}
                                                                onClick={() => {
                                                                    if (!voucher.isEligible) return
                                                                    if (selectVoucher && !(hasNonCancellableAutoApplyVoucher && selectedVoucher?.id !== voucher.id)) {
                                                                        if (selectedVoucher?.id === voucher.id) {
                                                                            selectVoucher(null as unknown as Voucher)
                                                                        } else {
                                                                            selectVoucher(voucher)
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {
                                                                    selectedVoucher?.id === voucher.id ? 'Batal' : 'Pilih'
                                                                }
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {voucher.isEligible && isExpiringSoon(voucherEndDate(voucher)) && (
                                                    <div className={`flex justify-end items-center text-xs font-medium mb-2 text-right ${selectedVoucher?.id !== voucher.id ? 'text-white' : 'text-red-500'}`}>
                                                        <span className='mr-2'>Berakhir pada:</span> <Badge variant="default" className='bg-yellow-500 text-white'>
                                                            <TimerIcon className='w-4 h-4 mr-2' />
                                                            <VoucherCountdown endDate={voucherEndDate(voucher)} />
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                }
                                {
                                    shippingVouchers.length > 0 && (
                                        <h4 className='text-lg font-semibold mt-4'>Voucher Ongkir yang tersedia</h4>
                                    )
                                }
                                {
                                    shippingVouchers.map((voucher: Voucher) => (
                                        <div key={voucher.id}>
                                            <div className={`rounded-md p-4 mt-4 w-full transition-all ${
                                                !voucher.isEligible 
                                                    ? 'bg-gray-300 opacity-60 cursor-not-allowed' 
                                                    : selectedShippingVoucher?.id === voucher.id 
                                                        ? 'bg-blue-100' 
                                                        : 'bg-blue-600'
                                            }`}>
                                                <div className='grid grid-cols-12 gap-4'>
                                                    <div className={`col-span-10 ${
                                                        !voucher.isEligible 
                                                            ? 'text-gray-500' 
                                                            : selectedShippingVoucher?.id !== voucher.id 
                                                                ? 'text-white' 
                                                                : 'text-blue-500'
                                                    }`}>
                                                        <div className='text-xl font-semibold'>{voucher.name}</div>
                                                        {!voucher.isEligible && voucher.ineligibleReason && (
                                                            <div className='text-xs font-medium mt-1 mb-1 text-gray-600 bg-gray-200 rounded px-2 py-0.5 inline-block'>
                                                                {formatCurrencyInText(voucher.ineligibleReason)}
                                                            </div>
                                                        )}
                                                        {selectedShippingVoucher?.id === voucher.id && voucher.isAutoApply && !voucher.isCancellable && (
                                                            <div className='text-xs font-medium mt-1 mb-1 opacity-80'>
                                                                Voucher tidak bisa dibatalkan
                                                            </div>
                                                        )}
                                                        <div className='text-xs mt-1 space-y-0.5'>
                                                            {voucher.discount > 0 && (
                                                                <div>Diskon: {voucherDiscountLabel(voucher)}</div>
                                                            )}
                                                            {voucher.minTransaction > 0 && (
                                                                <div>Min. transaksi: {priceToIDR(voucher.minTransaction)}</div>
                                                            )}
                                                        </div>
                                                        {voucherScopeLabel(voucher) && (
                                                            <div className='text-xs font-semibold mt-1 inline-block rounded border border-current px-2 py-0.5'>
                                                                {voucherScopeLabel(voucher)}
                                                            </div>
                                                        )}
                                                        <p className='break-words text-sm line-clamp-2 w-5/6'>{voucher.description}</p>
                                                        <div className='text-xs'>Berlaku hingga {dateStringToLocale(voucherEndDate(voucher))}</div>
                                                    </div>
                                                    <div className='col-span-2 flex items-center justify-end'>
                                                        {!voucher.isEligible ? null : selectedShippingVoucher?.id === voucher.id && voucher.isAutoApply && !voucher.isCancellable ? null : (
                                                            <Button 
                                                                variant="destructive" 
                                                                className='border border-white bg-blue-600 hover:bg-blue-700'
                                                                disabled={!voucher.isEligible || (hasNonCancellableAutoApplyShippingVoucher && selectedShippingVoucher?.id !== voucher.id)}
                                                                onClick={() => {
                                                                    if (!voucher.isEligible) return
                                                                    if (selectShippingVoucher && !(hasNonCancellableAutoApplyShippingVoucher && selectedShippingVoucher?.id !== voucher.id)) {
                                                                        if (selectedShippingVoucher?.id === voucher.id) {
                                                                            selectShippingVoucher(null as unknown as Voucher)
                                                                        } else {
                                                                            selectShippingVoucher(voucher)
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                {
                                                                    selectedShippingVoucher?.id === voucher.id ? 'Batal' : 'Pilih'
                                                                }
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                {voucher.isEligible && isExpiringSoon(voucherEndDate(voucher)) && (
                                                    <div className={`flex justify-end items-center text-xs font-medium mb-2 text-right ${selectedShippingVoucher?.id !== voucher.id ? 'text-white' : 'text-blue-500'}`}>
                                                        <span className='mr-2'>Berakhir pada:</span> <Badge variant="default" className='bg-yellow-500 text-white'>
                                                            <TimerIcon className='w-4 h-4 mr-2' />
                                                            <VoucherCountdown endDate={voucherEndDate(voucher)} />
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        )
                    }

                </DialogContent>
            </Dialog>
        </>
    )
}

export default PickVoucher