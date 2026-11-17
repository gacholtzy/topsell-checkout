import React from 'react'
import { Dialog, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from './ui/dialog';
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"
import { Input } from './ui/input';
import { useAddress } from '../context/address';
import { Button } from './ui/button';
import { Store, ShippingDestinationInput } from '../interface/address';
import { ProductIDSAndQuantity } from '../interface/product';
import { BranchSummary } from '../interface/stock';
import { fetchBranchSummaries } from '../lib/stock-utils';
import { useAuthStore } from '../lib/useAuthStore';
import { useCart } from '../context/cart';
import { useShipping } from '../context/shipping';
import { usePickupStock } from '../context/pickup-stock';

// Custom DialogContent without close button
const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
))
CustomDialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * Availability badge on a store card, plus how much of the basket the shop
 * actually holds.
 *
 * Green means the shop holds at least part of the basket — deliberately not
 * "holds everything", because at this point the customer is only deciding which
 * shop to open. Exactly what is missing is listed once they pick one.
 *
 * The colours stay solid in both states. An earlier version turned both badges
 * into white pills once a card was selected (the selected card is red), which
 * made available and unavailable look identical.
 *
 * A branch whose POS cannot be reached never gets this far: it is not listed at
 * all (see visibleStores), so there is no "cannot be checked" badge to draw.
 */
const StockBadge = ({
    summary,
    loading,
}: {
    summary?: BranchSummary;
    loading: boolean;
}) => {
    const pill =
        'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ring-1 ring-white'

    if (loading && !summary) {
        return <span className={`${pill} bg-slate-200 text-slate-600`}>Mengecek…</span>
    }
    if (!summary) return null

    // Ebikes are counted as available here. They are not short of anything —
    // Affari simply does not carry them, WooCommerce stock governs them, and
    // the branch hands them over like any other item. Leaving them out made a
    // basket of 5 read "3/3", which looks like two items quietly vanished.
    const unmonitored = summary.unmonitoredItems ?? 0
    const total = summary.totalItems + unmonitored
    const available = summary.availableItems + unmonitored

    if (total === 0) return null
    if (available > 0) {
        // A fraction only earns its place when it says something. "2/2" is just
        // "everything", so the badge says that; "3/5" is the number the customer
        // needs to decide whether the branch is worth picking.
        return (
            <span className={`${pill} bg-emerald-600 text-white`}>
                {available === total ? 'Tersedia' : `Tersedia ${available}/${total}`}
            </span>
        )
    }
    return <span className={`${pill} bg-red-700 text-white`}>Tidak tersedia 0/{total}</span>
}

/**
 * What the badge means, in words, plus WHICH items are short.
 *
 * The count on its own ("2 dari 3") is not actionable — the customer cannot
 * tell whether the missing item is the one they came for — so the names are
 * listed here rather than held back until a branch is chosen.
 */
const StockDetail = ({ summary, selected }: { summary?: BranchSummary; selected: boolean }) => {
    if (!summary) return null

    const unmonitored = summary.unmonitoredItems ?? 0
    const total = summary.totalItems + unmonitored
    const available = summary.availableItems + unmonitored

    if (total === 0) return null

    if (available === total) {
        return <p className='text-sm opacity-90'>Semua {total} barang tersedia di sini</p>
    }

    return (
        <div className='mt-1 text-sm'>
            <p className='opacity-90'>
                {available} dari {total} barang tersedia. Yang tidak tersedia:
            </p>
            <ul className='mt-1 space-y-0.5'>
                {(summary.missingItems ?? []).map((item, i) => (
                    <li
                        key={`${item.productId}-${item.variationId ?? ""}-${i}`}
                        className={selected ? 'text-white' : 'text-red-700'}
                    >
                        • {item.name || 'Barang di keranjang'}
                        {item.available > 0 && (
                            <span className='opacity-90'>
                                {" "}— sisa {item.available}, dipesan {item.requested}
                            </span>
                        )}
                        {item.available <= 0 && <span className='opacity-90'> — kosong</span>}
                    </li>
                ))}
            </ul>
            {/* Said here, before the tap, not only on the checkout page after
                it, so the customer knows what choosing this branch will ask
                of them on the next screen. */}
            <p className='mt-1 opacity-90'>
                Jika memilih cabang ini, kamu bisa mengambil sejumlah yang tersedia
                atau mengeluarkan barang tersebut dari pesanan di halaman checkout.
            </p>
        </div>
    )
}

const AreaDialog = ({
    open,
    onOpenChange,
    getShippingCost,
    productIDSAndQuantities
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    getShippingCost: (dest: ShippingDestinationInput, productIDSAndQuantities: ProductIDSAndQuantity[]) => void;
    productIDSAndQuantities: ProductIDSAndQuantity[];
}) => {
    const { stores, searchStore, setSearchStore, selectedStore, selectStore, selectedDestinationID, selectedPostalCode } = useAddress()
    const hasDestination = !!selectedDestinationID
    const destination = (): ShippingDestinationInput => ({
        destinationID: selectedDestinationID || '',
        postalCode: selectedPostalCode || '',
    })
    const { token } = useAuthStore()
    const { cartQuery, resetPickupAdjustments } = useCart()
    const { shippingMethods, selectShippingMethod } = useShipping()
    const { seedStock, setPickerOpen } = usePickupStock()

    // While the picker is open the checkout page's own stock check stands
    // down: tapping between branches changes the selected store on every tap,
    // and answering for each one only produced flicker behind the dialog.
    React.useEffect(() => {
        setPickerOpen(open)
        return () => setPickerOpen(false)
    }, [open, setPickerOpen])

    // Availability per shop, so the customer can tell which branches are worth
    // opening before committing to one. Loaded only while the dialog is open —
    // it is one POS call per branch and the answer goes stale quickly.
    const [summaries, setSummaries] = React.useState<Record<string, BranchSummary>>({})
    const [summariesLoading, setSummariesLoading] = React.useState(false)

    // Always asked about the WHOLE basket (cartQuery is never narrowed), so a
    // branch is judged on everything the customer wants, whatever an earlier
    // branch made them trim.
    React.useEffect(() => {
        if (!open || !token) return
        let cancelled = false
        setSummariesLoading(true)
        fetchBranchSummaries(token, cartQuery)
            .then((rows) => {
                if (cancelled) return
                setSummaries(Object.fromEntries(rows.map((r) => [r.storeId, r])))
            })
            .finally(() => { if (!cancelled) setSummariesLoading(false) })
        // A superseded request must not leave the dialog reading "Mengecek…"
        // forever: its own finally is skipped above, so clear the flag here.
        return () => { cancelled = true; setSummariesLoading(false) }
    }, [open, token, cartQuery])

    // Only the shops worth opening are listed. With most branches short of most
    // of the catalogue, showing every one of them buries the ones that can
    // actually serve the basket under a long scroll of dead ends.
    //
    // The bar is "holds SOMETHING", not "holds everything". A branch with 3 of
    // 5 rows is still worth opening: picking it buys those three and takes the
    // other two out of the order. Hiding it would cost the customer a sale we
    // can actually make. What it holds is on the badge, so the choice is made
    // with the number in view rather than after committing.
    //
    // Two kinds of branch are hidden: one that can fill nothing, and one whose
    // stock could not be checked. A shop we cannot see into is not one the
    // customer can be offered — choosing it only ends at a refused pickup — and
    // the list is better short than padded with branches nobody can pick.
    //
    // One case is deliberately NOT hidden: no summary at all. That is either
    // "still loading" or "the whole request failed", and in both nothing is known
    // about any branch; hiding every shop on that basis would announce that the
    // basket is unavailable everywhere when the real fault is ours. The checkout
    // guard still refuses a pickup it cannot verify.
    const visibleStores = React.useMemo(() => {
        return stores.filter((store) => {
            const summary = summaries[store.id]
            if (!summary) return true
            if (!summary.reachable) return false
            // Nothing in the basket was checkable — every row sits outside the
            // POS catalogue (ebikes, and today any blank-SKU product). The
            // backend lets those through checkout, so hiding every branch here
            // would refuse in the UI what the server is about to allow.
            if (summary.totalItems === 0) return true
            return summary.availableItems > 0
        })
    }, [stores, summaries])

    const hiddenCount = stores.length - visibleStores.length

    // Distinct from "the list is empty": there are branches, every one of them
    // was checked, and not one can serve this basket. Only then is it true to
    // tell the customer to switch to delivery.
    const nothingAvailable =
        !summariesLoading && stores.length > 0 && visibleStores.length === 0

    // The same empty list can mean two different things. If every branch was
    // merely unreachable, none of them was found to be out of stock, and telling
    // the customer "not available anywhere" would state something nobody checked.
    const allUnreachable =
        nothingAvailable && stores.every((store) => summaries[store.id] && !summaries[store.id].reachable)

    const deliveryMethod = shippingMethods.find((m) => m.title === "Diantar ke Alamat")

    const switchToDelivery = () => {
        if (!deliveryMethod || !selectShippingMethod) return
        // Drop the branch first: leaving it selected would keep the summary line
        // reading "Ambil di Toko - <shop>" under a delivery order.
        selectStore?.(null as any)
        selectShippingMethod(deliveryMethod)
        onOpenChange(false)
        if (hasDestination && productIDSAndQuantities) {
            getShippingCost(destination(), productIDSAndQuantities)
        }
    }

    // Debounce: daftar toko diminta 300ms setelah berhenti mengetik, bukan tiap huruf.
    const [keyword, setKeyword] = React.useState(searchStore || '');
    React.useEffect(() => {
        if (keyword === (searchStore || '')) return;
        const timeoutId = setTimeout(() => setSearchStore?.(keyword), 300);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setKeyword(e.target.value);
    };

    // A branch that can fill nothing must not be pickable. The filter above
    // already keeps it off the list, so this is the second lock rather than the
    // first: summaries arrive per branch and a single late or refreshed answer
    // can put a card on screen that the filter has not caught up with, and a
    // customer who taps it commits to a shop holding none of their order.
    const isUnselectable = (store: Store) => {
        const summary = summaries[store.id]
        if (!summary) return false
        if (!summary.reachable) return true // not listed, and not pickable if one slips through
        if (summary.totalItems === 0) return false // nothing was checkable, not nothing in stock
        return summary.availableItems === 0
    }

    const handleStoreSelect = (store: Store) => {
        if (isUnselectable(store)) return;

        // Nothing is selectable until the availability check finishes: picking a
        // branch while the badges still read "Mengecek…" is choosing blind, and
        // the customer would only learn the shop is short after committing.
        // Note this unblocks on failure too — summariesLoading goes false either
        // way — so a POS outage degrades to the old behaviour instead of
        // freezing the dialog shut.
        if (summariesLoading) return;

        if (selectedStore && selectedStore.name === store.name) {
            selectStore?.(null as any);
            return;
        } else {
            selectStore?.(store);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <CustomDialogContent
                className='overflow-y-auto max-h-[calc(100vh-4rem)]'
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>Pilih Lokasi Toko</DialogTitle>
                </DialogHeader>
                <div className='sticky top-0 bg-white z-10'>
                    <Input placeholder='Cari lokasi toko' value={keyword} onChange={handleSearchChange} />
                    {summariesLoading && (
                        <p className='mt-2 text-sm text-slate-500'>
                            Mengecek ketersediaan barang di setiap cabang…
                        </p>
                    )}
                </div>
                {nothingAvailable && (
                    <div className='rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900'>
                        <p className='font-medium'>
                            {allUnreachable
                                ? 'Stok di cabang belum bisa dicek saat ini.'
                                : 'Barang di keranjang tidak tersedia di cabang mana pun.'}
                        </p>
                        <p className='mt-1'>
                            Silakan pilih pengiriman ke alamat, atau kembali ke keranjang
                            untuk mengubah pesanan.
                        </p>
                        {deliveryMethod && (
                            <Button
                                variant='destructive'
                                className='mt-3 w-full'
                                onClick={switchToDelivery}
                            >
                                Diantar ke Alamat
                            </Button>
                        )}
                    </div>
                )}
                {hiddenCount > 0 && visibleStores.length > 0 && (
                    <p className='text-sm text-slate-500'>
                        {hiddenCount} cabang lain disembunyikan karena tidak punya satu
                        pun barang yang dipesan atau stoknya belum bisa dicek.
                    </p>
                )}
                <div className='space-y-4'>
                    {visibleStores.map((store, index) => {
                        const blocked = isUnselectable(store)
                        return (
                        <div key={index}
                            aria-disabled={summariesLoading || blocked}
                            className={`border-slate-300 p-4 rounded-md ${summariesLoading ? 'cursor-wait opacity-60' : blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selectedStore && selectedStore.name === store.name ? 'bg-red-500 text-white' : 'border'}`}
                            onClick={() => handleStoreSelect(store)}
                        >
                            <div className='flex items-start justify-between gap-3'>
                                <h3 className='text-lg font-semibold'>{store.name} - {store.storeArea.name}</h3>
                                <StockBadge
                                    summary={summaries[store.id]}
                                    loading={summariesLoading}
                                />
                            </div>
                            <p className='text-sm'>{store.address}</p>
                            <StockDetail
                                summary={summaries[store.id]}
                                selected={!!selectedStore && selectedStore.name === store.name}
                            />
                        </div>
                        )
                    })}
                </div>
                {/* Hidden when there is nothing to pick: a permanently disabled
                    "Pilih" under an empty list reads as a broken dialog, and the
                    panel above already carries the way out. */}
                <div className={`sticky bottom-0 bg-white z-10 ${nothingAvailable ? 'hidden' : ''}`}>
                    <Button variant="destructive" className='w-full'
                        disabled={!selectedStore || summariesLoading}
                        onClick={() => {
                            if (!selectedStore) {
                                return;
                            }
                            // Hand over the answer we already have. Without it
                            // the checkout page asks the backend the same
                            // question again and the customer waits through a
                            // spinner for a reply that is already on screen.
                            const seed = summaries[selectedStore.id]?.stock;
                            if (seed) {
                                seedStock(seed, selectedStore.id);
                            }
                            // A fresh branch starts from the whole basket; the
                            // seed above describes exactly that.
                            resetPickupAdjustments();
                            onOpenChange(false);
                            if (hasDestination && productIDSAndQuantities) {
                                getShippingCost(destination(), productIDSAndQuantities);
                            }
                        }}>Pilih</Button>
                </div>
            </CustomDialogContent>
        </Dialog>
    )
}

export default AreaDialog