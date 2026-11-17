"use client";
import { useCart } from '../context/cart';
import { Product } from '../interface/product';
import { StockItem } from '../interface/stock';
import { CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import React from 'react'
import { priceToIDR } from '../lib/helper';
import { getImageAlt, getImageSrc } from '@/lib/image-utils';
import { usePickupStock, PICKUP_METHOD_TITLE } from '../context/pickup-stock';
import { useShipping } from '../context/shipping';
import { useAddress } from '../context/address';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

/**
 * The rows being bought. Under "Ambil di Toko", once a branch is chosen, each
 * row also carries the branch's answer for it, and a row the branch cannot
 * fill offers the two ways to fix the order without leaving the page: take
 * what is there, or leave the row out. Nothing is ever taken out on the
 * customer's behalf.
 */
const ProductDetail = () => {
    const {
        cartItemsToCheckout, excludedItemIds, qtyOverrides,
        excludeFromCheckout, includeInCheckout, setCheckoutQty,
    } = useCart()
    const { stock } = usePickupStock()
    const { selectedShippingMethod } = useShipping()
    const { selectedStore } = useAddress()

    const pickupActive = selectedShippingMethod?.title === PICKUP_METHOD_TITLE && !!selectedStore
    const excluded = React.useMemo(() => new Set(excludedItemIds), [excludedItemIds])
    const stockByItem = React.useMemo(() => {
        const map: Record<string, StockItem> = {}
        for (const item of stock?.items ?? []) {
            if (item.itemId) map[item.itemId] = item
        }
        return map
    }, [stock])

    const renderPickupState = (product: Product) => {
        const itemId = product.cartItemId
        if (!pickupActive || !itemId) return null

        if (excluded.has(itemId)) {
            return (
                <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
                    <span>Dikeluarkan dari pesanan ini</span>
                    <Button variant='outline' size='sm' className='h-7' onClick={() => includeInCheckout(itemId)}>
                        Masukkan kembali
                    </Button>
                </div>
            )
        }

        const line = stockByItem[itemId]
        const override = qtyOverrides[itemId]
        const restore = override !== undefined && (
            <Button variant='ghost' size='sm' className='h-7 px-2 text-muted-foreground' onClick={() => setCheckoutQty(itemId, null)}>
                Kembalikan ke {product.qty}
            </Button>
        )

        if (!line) return restore ? <div className='mt-2'>{restore}</div> : null

        if (line.sufficient) {
            return (
                <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-success'>
                    <CheckCircle2Icon className='h-4 w-4 shrink-0' />
                    <span>Tersedia di {stock?.branchName || 'toko ini'}</span>
                    {restore}
                </div>
            )
        }

        return (
            <div className='mt-2 space-y-2 text-sm'>
                <div className='flex items-start gap-2 text-destructive'>
                    <AlertCircleIcon className='mt-0.5 h-4 w-4 shrink-0' />
                    <span>{line.message || 'Tidak tersedia di toko ini'}</span>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    {line.available > 0 && (
                        <Button size='sm' className='h-8' onClick={() => setCheckoutQty(itemId, line.available)}>
                            Ambil {line.available}
                        </Button>
                    )}
                    <Button variant='outline' size='sm' className='h-8' onClick={() => excludeFromCheckout(itemId)}>
                        Keluarkan
                    </Button>
                    {restore}
                </div>
            </div>
        )
    }

    return (
        <ul className='divide-y' aria-live='polite'>
            {
                cartItemsToCheckout.length > 0 ? cartItemsToCheckout.map((product: Product) => {
                    const itemId = product.cartItemId
                    const isExcluded = !!itemId && excluded.has(itemId)
                    const qty = (itemId && qtyOverrides[itemId]) || product.qty
                    const hasDiscount = product.price != product.regularPrice && product.regularPrice != 0
                    const unit = product.price != product.regularPrice && product.regularPrice == 0 ? product.price : product.regularPrice
                    return (
                    <li className={`flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4 ${isExcluded ? 'opacity-55' : ''}`} key={itemId || product.id}>
                        <img
                            src={product.images.length > 0 ? getImageSrc(product.images[0]) : '/images/placeholder-image.svg'}
                            alt={product.images.length > 0 ? getImageAlt(product.images[0], 'Product') : 'Produk'}
                            className='h-16 w-16 shrink-0 rounded-md border bg-secondary object-contain sm:h-20 sm:w-20'
                        />
                        <div className='min-w-0 flex-1'>
                            <p className={`text-sm font-semibold leading-snug sm:text-base ${isExcluded ? 'line-through' : ''}`}>{product.name}</p>
                            {product.variationName && (
                                <p className='mt-0.5 text-sm text-muted-foreground'>{product.variationName}</p>
                            )}
                            <div className='mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
                                <span className='text-sm text-muted-foreground tabular-nums'>
                                    {qty} × {priceToIDR(unit)}
                                    {qty !== product.qty && <span className='ml-1 text-xs'>(di keranjang {product.qty})</span>}
                                </span>
                                <span className='text-right'>
                                    {hasDiscount && <span className='mr-2 text-xs text-muted-foreground line-through tabular-nums'>{priceToIDR(product.price * qty)}</span>}
                                    <span className='text-base font-bold tabular-nums'>{priceToIDR(unit * qty)}</span>
                                </span>
                            </div>
                            {renderPickupState(product)}
                        </div>
                    </li>
                    )
                }) : <li className='flex gap-3 py-1' role='status' aria-label='Memuat data produk'><Skeleton className='size-16 shrink-0 sm:size-20' /><div className='flex-1 space-y-2'><Skeleton className='h-4 w-3/4' /><Skeleton className='h-4 w-1/2' /></div></li>
            }
        </ul>
    )
}

export default ProductDetail
