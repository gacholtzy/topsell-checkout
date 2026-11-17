"use client";
import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { ChevronDownIcon, Loader2 } from 'lucide-react';
import { useShipping } from '../context/shipping';
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from './ui/input';
import { useAddress } from '../context/address';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { useAddressStore } from '../lib/store';
import { Address, AddressArea, AddressSearchResult, ShippingDestinationInput, formatAddressArea } from '../interface/address';
import AreaDialog from './area-dialog';
import { Badge } from './ui/badge';
import { useCart } from '../context/cart';
import { ProductIDSAndQuantity } from '../interface/product';
import { useGlobalDialog } from './global/useGlobalDialog';
import { AddressSearch } from './address-search';

const FormSchema = z.object({
    name: z.string().min(3, "Nama harus lebih dari 3 karakter"),
    email: z.string().email("Invalid email"),
    phone: z.string().min(10).regex(/^08[0-9]+$/, 'Invalid phone number'),
    selectedAddress: z.string(),
    destinationID: z.string(),
    address: z.string().min(10, "Alamat tidak boleh kosong atau kurang dari 10 karakter"),
}).superRefine((data, ctx) => {
    // The destination only exists once a Biteship suggestion is picked; typed
    // text alone has no area id, no city and no district behind it. The message
    // sits under the search box, where the customer has to act on it.
    if (!data.destinationID) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['selectedAddress'],
            message: "Pilih kecamatan dari daftar, lalu pilih kode posnya.",
        });
    }
});

type FormValues = z.infer<typeof FormSchema>;

const emptyForm: FormValues = {
    name: '',
    email: '',
    phone: '',
    selectedAddress: '',
    destinationID: '',
    address: '',
};

const areaFromSearch = (result: AddressSearchResult): AddressArea => ({
    province: result.province_name,
    city: result.city_name,
    subdistrict: result.subdistrict_name || result.district_name,
    postal_code: result.zip_code,
    destinationID: result.id,
});

const AddressModal = ({
    open,
    onOpenChange,
    jumpToArea = false,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Skip the address step and go straight to the branch picker.
     *
     * Used by the "Pilih cabang lain" button on the stock warning: the customer
     * has already given an address and only wants to change shop, so making
     * them walk back through the address form would be busywork. The branch
     * dialog lives here because it needs getShippingCost, which is defined in
     * this file — hence a flag rather than lifting the dialog out.
     */
    jumpToArea?: boolean;
}) => {
    const { selectedShippingMethod } = useShipping();
    const { selectAddressArea, setIsAddressSubmitted, isAddressSubmitted } = useAddress();
    const { showAlertDialog } = useGlobalDialog();
    const { getAddresses, setAddressState } = useAddressStore();
    const [areaDialogOpen, setAreaDialogOpen] = React.useState(false);

    React.useEffect(() => {
        if (open && jumpToArea) {
            onOpenChange(false);
            setAreaDialogOpen(true);
        }
    }, [open, jumpToArea, onOpenChange]);
    const [originalFormData, setOriginalFormData] = React.useState<FormValues | null>(null);
    const { shippingMethods, selectShippingMethod, fetchShippingOptions } = useShipping();
    const { cartItemsToCheckout } = useCart();

    // The district behind the form's destinationID: Biteship's names and
    // postal code. Lives beside the form because it is picked, not typed.
    const [area, setArea] = React.useState<AddressArea | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(FormSchema),
        defaultValues: emptyForm,
    })

    const validatePostalCode = async (postalCode: string) => {
        const res = await fetch(`/backend/topsell-area-postal/check-postal-code-is-exist/${postalCode}`);
        const data = await res.json();
        return data.data;
    }

    const handleSubmit = async (data: FormValues) => {
        setIsAddressSubmitted(true);
        const dataAddress: Address = {
            name: data.name,
            email: data.email,
            phone: data.phone,
            province: area?.province || '',
            city: area?.city || '',
            subdistrict: area?.subdistrict || '',
            postal_code: area?.postal_code || '',
            address: data.address,
            destinationID: data.destinationID || area?.destinationID || '',
        }
        setAddressState(dataAddress);
        selectAddressArea?.(dataAddress);
        const productIDSAndQuantities = cartItemsToCheckout?.map((product) => ({
            id: product.id.toString(),
            quantity: product.qty,
            variationId: product.variationId
        }));

        // Cek area Topsell dan hitung ongkir tidak saling bergantung: jalan bersamaan,
        // bukan berurutan, supaya modal tertutup satu round trip lebih cepat.
        const needsShippingCost = !!(dataAddress.destinationID && productIDSAndQuantities && selectedShippingMethod?.title !== "Ambil di Toko");
        const [isWithinTopsellArea, calculatedShippingCost] = await Promise.all([
            validatePostalCode(dataAddress.postal_code),
            needsShippingCost
                ? getShippingCost({
                    destinationID: dataAddress.destinationID,
                    postalCode: dataAddress.postal_code,
                }, productIDSAndQuantities)
                : Promise.resolve<number | null>(null),
        ]);

        // Check if city is supported
        if (!isWithinTopsellArea) {
            // City not supported
            // If current method is "Ambil di Toko" or "Diantar ke Alamat", show alert and switch to "Pengiriman Reguler"
            if (selectedShippingMethod && (selectedShippingMethod.title === "Ambil di Toko" || selectedShippingMethod.title === "Diantar ke Alamat")) {
                // Find "Pengiriman Reguler" method
                const regularShippingMethod = shippingMethods.find(method => method.title === "Pengiriman Reguler");

                // Show alert dialog
                showAlertDialog({
                    title: "Informasi",
                    message: "Area tidak dicakup dalam area Topsell. Metode pengiriman diubah ke Pengiriman Reguler.",
                    iconType: "info"
                });

                // Switch to regular shipping method
                if (regularShippingMethod && selectShippingMethod) {
                    selectShippingMethod(regularShippingMethod);
                }
            }

            // Close address modal
            onOpenChange(false);
        } else {
            // City is supported
            if (selectedShippingMethod?.title === "Ambil di Toko") {
                // Open area dialog for "Ambil di Toko" option
                onOpenChange(false);
                setAreaDialogOpen(true);
            } else {
                // For other methods, just close the address modal
                onOpenChange(false);

                // If address is within Topsell area and current method is "Pengiriman Reguler", switch to "Diantar ke Alamat"
                if (selectedShippingMethod?.title === "Pengiriman Reguler") {
                    if (calculatedShippingCost === 0) {
                        const deliveryMethod = shippingMethods.find(method => method.title === "Diantar ke Alamat");
                        if (deliveryMethod && selectShippingMethod) {
                            selectShippingMethod(deliveryMethod);
                        }
                    } else {
                        const regularShippingMethod = shippingMethods.find(method => method.title === "Pengiriman Reguler");
                        if (regularShippingMethod && selectShippingMethod) {
                            selectShippingMethod(regularShippingMethod);
                        }

                        // Informasikan bahwa area Topsell tidak selalu gratis untuk kategori elektronik.
                        showAlertDialog({
                            title: "Informasi",
                            message: "Produk elektronik pada area ini tidak termasuk gratis ongkir. Metode tetap Pengiriman Reguler.",
                            iconType: "info"
                        });
                    }
                }

                // If current method is "Diantar ke Alamat" but shipping cost > 0 (elektronik + postal is_electronic = false),
                // switch back to "Pengiriman Reguler"
                if (selectedShippingMethod?.title === "Diantar ke Alamat") {
                    if (calculatedShippingCost !== null && calculatedShippingCost > 0) {
                        const regularShippingMethod = shippingMethods.find(method => method.title === "Pengiriman Reguler");
                        if (regularShippingMethod && selectShippingMethod) {
                            selectShippingMethod(regularShippingMethod);
                        }
                        showAlertDialog({
                            title: "Informasi",
                            message: "Produk elektronik pada area ini tidak termasuk gratis ongkir. Metode pengiriman diubah ke Pengiriman Reguler.",
                            iconType: "info"
                        });
                    }
                }
            }
        }
    }

    // Quotes every courier for the address (the picker under the shipping
    // method lists them) and returns the picked service's price, which the
    // method-switching logic above reads as "the" shipping cost.
    const getShippingCost = async (dest: ShippingDestinationInput, productIDSAndQuantities: ProductIDSAndQuantity[]): Promise<number | null> => {
        return fetchShippingOptions(dest, productIDSAndQuantities);
    }

    const setFormAddress = () => {
        const addressState = getAddresses();
        if (addressState !== null) {
            const savedArea: AddressArea = {
                province: addressState.province || '',
                city: addressState.city || '',
                subdistrict: addressState.subdistrict || '',
                postal_code: addressState.postal_code || '',
                destinationID: addressState.destinationID || '',
            };
            const formData: FormValues = {
                name: addressState?.name || '',
                email: addressState?.email || '',
                phone: addressState?.phone || '',
                selectedAddress: formatAddressArea(savedArea),
                destinationID: savedArea.destinationID,
                address: addressState.address || ''
            };

            form.reset(formData);
            setArea(savedArea.destinationID ? savedArea : null);

            // Store original data for cancel functionality
            setOriginalFormData(formData);
        } else {
            // If no saved address, reset form to default values
            form.reset(emptyForm);
            setArea(null);
            setOriginalFormData(emptyForm);
        }
    }
    React.useEffect(() => {
        setFormAddress();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Store original form data when modal opens
    React.useEffect(() => {
        if (open) {
            const currentFormData = form.getValues();
            setOriginalFormData(currentFormData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const handleAddressSelect = (result: AddressSearchResult) => {
        const picked = areaFromSearch(result);
        setArea(picked);
        form.setValue('selectedAddress', result.label, { shouldDirty: true });
        form.setValue('destinationID', picked.destinationID, { shouldDirty: true });
        form.clearErrors('selectedAddress');
    }

    const savedAddress = getAddresses();

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={onOpenChange}
            >
                <DialogTrigger className='w-full text-left' asChild>
                    <button
                        type='button'
                        className='flex w-full items-start gap-3 rounded-lg border border-dashed border-input bg-card p-3.5 text-left transition-colors hover:bg-secondary'
                    >
                        {isAddressSubmitted && savedAddress ? (
                            <span className='min-w-0 flex-1 text-sm'>
                                <span className='block text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                                    {selectedShippingMethod?.title === "Ambil di Toko" ? 'Data pembeli' : 'Dikirim ke'}
                                </span>
                                <span className='mt-1 block font-semibold'>{savedAddress.name} <span className='font-normal text-muted-foreground'>· {savedAddress.phone}</span></span>
                                <span className='mt-0.5 block'>{savedAddress.address}</span>
                                <span className='block text-muted-foreground'>{formatAddressArea(savedAddress)}</span>
                            </span>
                        ) : (
                            <span className='min-w-0 flex-1 text-sm'>
                                <span className='block font-semibold'>Isi data pembeli dan alamat</span>
                                <span className='block text-muted-foreground'>Dibutuhkan untuk menghitung ongkos kirim.</span>
                            </span>
                        )}
                        <span className='shrink-0 text-sm font-semibold text-primary underline underline-offset-4'>
                            {isAddressSubmitted && savedAddress ? 'Ubah' : 'Isi'}
                        </span>
                    </button>
                </DialogTrigger>
                <DialogContent
                    className='max-h-[90dvh]'
                >
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)}>
                            <DialogHeader className='pb-6'>
                                <DialogTitle>Data Diri Pembeli</DialogTitle>
                            </DialogHeader>
                            <div className='space-y-3'>
                                <FormField
                                    control={form.control}
                                    name='name'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nama</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Masukkan nama" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='email'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="email" placeholder="Masukkan email" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='phone'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>No. Telepon</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Masukkan no. telepon" onChange={
                                                    (e) => {
                                                        const value = e.target.value;
                                                        if (!isNaN(Number(value))) {
                                                            field.onChange(e.target.value);
                                                        }
                                                    }
                                                } />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='selectedAddress'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kecamatan dan Kode Pos</FormLabel>
                                            <FormControl>
                                                <AddressSearch
                                                    value={field.value}
                                                    onChange={() => {
                                                        // Typing (or "Ubah") voids the previous pick: the
                                                        // old id no longer matches what is on screen. The
                                                        // field holds the pick's label, never the keystrokes.
                                                        field.onChange('');
                                                        form.setValue('destinationID', '');
                                                        setArea(null);
                                                    }}
                                                    onSelect={handleAddressSelect}
                                                    placeholder="Cari kecamatan atau kota"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name='address'
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Rincian Alamat</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} placeholder="Masukan alamat detail seperti Rt/Rw, No alamat rumah, Titik alamat dan lain -lain" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogDescription />
                            <DialogFooter className="gap-2 pt-4 sm:gap-0">
                                <Button variant="outline" onClick={() => {
                                    onOpenChange(false)
                                    // Revert to the saved address and clear all errors
                                    setFormAddress();
                                    form.clearErrors();
                                }} type="button">Batal</Button>
                                {/* Simpan menunggu cek area + ongkir kurir (bisa 1-2 detik); tanpa tanda ini terlihat macet. */}
                                <Button variant="destructive" type="submit" disabled={form.formState.isSubmitting}>
                                    {form.formState.isSubmitting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</>
                                    ) : "Simpan"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
            <AreaDialog open={areaDialogOpen}
                getShippingCost={getShippingCost}
                productIDSAndQuantities={cartItemsToCheckout?.map((product) => ({
                    id: product.id.toString(),
                    quantity: product.qty
                })) || []}
                onOpenChange={setAreaDialogOpen}
            />
        </>
    )
}

export default AddressModal
