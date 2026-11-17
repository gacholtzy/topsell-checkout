"use client"
import React from 'react'
import { Check, Truck } from 'lucide-react'
import { useShipping } from '../context/shipping'
import { priceToIDR } from '../lib/helper'
import { shippingOptionDuration, shippingOptionLabel } from '../interface/shipping'
import { Skeleton } from './ui/skeleton'
import { cn } from '../lib/utils'

/**
 * The courier services Biteship offers for the saved address, one per row.
 * Which couriers appear is decided in the Biteship dashboard; this only shows
 * what came back, cheapest first, and lets the customer pick one.
 */
const CourierOptions = () => {
    const { shippingOptions, shippingOptionsLoading, shippingOptionsError, selectedShippingOption, selectShippingOption } = useShipping()

    if (shippingOptionsLoading && shippingOptions.length === 0) {
        return (
            <div className='mt-3 space-y-2'>
                <Skeleton className='h-14 w-full' />
                <Skeleton className='h-14 w-full' />
            </div>
        )
    }

    if (shippingOptionsError && shippingOptions.length === 0) {
        return <p className='mt-3 text-sm text-red-600'>{shippingOptionsError}</p>
    }

    if (shippingOptions.length === 0) return null

    return (
        <div className='mt-3'>
            <p className='text-sm font-semibold mb-2'>Pilih Kurir</p>
            <div className='space-y-2' role='radiogroup' aria-label='Pilih kurir'>
                {shippingOptions.map((option) => {
                    const active = selectedShippingOption?.courierCode === option.courierCode
                        && selectedShippingOption?.courierServiceCode === option.courierServiceCode
                    const duration = shippingOptionDuration(option)
                    return (
                        <button
                            type='button'
                            role='radio'
                            aria-checked={active}
                            key={`${option.courierCode}-${option.courierServiceCode}`}
                            onClick={() => selectShippingOption(option)}
                            className={cn(
                                'w-full flex items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors',
                                active ? 'border-red-500 bg-red-50' : 'border-slate-300 hover:bg-slate-50',
                                shippingOptionsLoading && 'opacity-60'
                            )}
                        >
                            <div className='flex items-center gap-3 min-w-0'>
                                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', active ? 'border-red-500 bg-red-500 text-white' : 'border-slate-400')}>
                                    {active && <Check className='h-3.5 w-3.5' />}
                                </span>
                                <div className='min-w-0'>
                                    <div className='font-semibold flex items-center gap-2'>
                                        <Truck className='h-4 w-4 text-slate-500 shrink-0' />
                                        <span className='truncate'>{shippingOptionLabel(option)}</span>
                                    </div>
                                    {duration && <div className='text-xs text-gray-500'>Estimasi {duration}</div>}
                                </div>
                            </div>
                            <div className='text-right shrink-0'>
                                {option.price > 0 ? (
                                    <span className='font-semibold'>{priceToIDR(option.price)}</span>
                                ) : (
                                    <span className='font-semibold text-green-600'>GRATIS</span>
                                )}
                                {option.price > 0 && option.listPrice > option.price && (
                                    <div className='text-xs text-gray-400 line-through'>{priceToIDR(option.listPrice)}</div>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default CourierOptions
