"use client";
import { useCart } from '../context/cart';
import { Product } from '../interface/product';
import { StockItem } from '../interface/stock';
import { Dot, CheckCircle2Icon, AlertCircleIcon } from 'lucide-react';
import React from 'react'
import { priceToIDR } from '../lib/helper';
import { getImageAlt, getImageSrc } from '@/lib/image-utils';
import { usePickupStock, PICKUP_METHOD_TITLE } from '../context/pickup-stock';
import { useShipping } from '../context/shipping';
import { useAddress } from '../context/address';
import { Button } from './ui/button';

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
                <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600'>
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
            <Button variant='ghost' size='sm' className='h-7 px-2 text-slate-600' onClick={() => setCheckoutQty(itemId, null)}>
                Kembalikan ke {product.qty}
            </Button>
        )

        if (!line) return restore ? <div className='mt-2'>{restore}</div> : null

        if (line.sufficient) {
            return (
                <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-emerald-700'>
                    <CheckCircle2Icon className='h-4 w-4 shrink-0' />
                    <span>Tersedia di {stock?.branchName || 'toko ini'}</span>
                    {restore}
                </div>
            )
        }

        return (
            <div className='mt-2 space-y-2 text-sm'>
                <div className='flex items-start gap-2 text-red-700'>
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
        <div className='pt-12 space-y-6'>
            <h4 className='text-xl font-extrabold'>Produk yang dibeli</h4>
            {
                cartItemsToCheckout.length > 0 ? cartItemsToCheckout.map((product: Product) => {
                    const itemId = product.cartItemId
                    const isExcluded = !!itemId && excluded.has(itemId)
                    const qty = (itemId && qtyOverrides[itemId]) || product.qty
                    return (
                    <div className={`flex gap-4 ${isExcluded ? 'opacity-50' : ''}`} key={itemId || product.id}>
                        <div className="flex items-center self-stretch">
                            {
                                product.images.length > 0 ?
                                    <img src={getImageSrc(product.images[0])}
                                        className='w-20 h-full object-cover'
                                        alt={getImageAlt(product.images[0], 'Product')} />
                                    : <img src='/images/placeholder-image.svg'
                                        className='w-20 h-full object-cover'
                                        alt='Product' />
                            }
                        </div>
                        <div className='flex-1'>
                            <h1 className={`font-bold md:text-base text-sm ${isExcluded ? 'line-through' : ''}`}>{product.name}</h1>
                            {
                                product.variationName && (
                                    <div className='flex items-center justify-start'><Dot className='w-6 h-6' /> <span className='text-sm font-bold text-slate-500'>{product.variationName}</span></div>
                                )
                            }
                            <div className='flex items-center justify-start space-x-2'>
                                <span className='text-base'>{qty}x</span>
                                {qty !== product.qty && (
                                    <span className='text-xs text-slate-500'>(di keranjang {product.qty})</span>
                                )}
                                {
                                    (product.price != product.regularPrice && product.regularPrice != 0) &&
                                    <span className='text-sm line-through text-slate-500'>{priceToIDR(product.price * qty)}</span>
                                }
                                <span className='text-base font-bold'>{
                                    product.price != product.regularPrice && product.regularPrice == 0 ?
                                        priceToIDR(product.price * qty) : priceToIDR(product.regularPrice * qty)
                                }</span>
                            </div>
                            {renderPickupState(product)}
                        </div>
                    </div>
                    )
                }) : <div className='w-full flex justify-center items-center'>
                    {/*create spinner*/}
                    <span>Memuat data produk...</span>
                </div>
            }
        </div >
    )
}

export default ProductDetail
