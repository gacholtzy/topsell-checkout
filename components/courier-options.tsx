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
        return <p className='mt-3 text-sm text-destructive'>{shippingOptionsError}</p>
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
                                'w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors',
                                active ? 'border-primary bg-accent ring-1 ring-primary/30' : 'border-input hover:bg-secondary/70',
                                shippingOptionsLoading && 'opacity-60'
                            )}
                        >
                            <div className='flex items-center gap-3 min-w-0'>
                                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40')}>
                                    {active && <Check className='h-3.5 w-3.5' />}
                                </span>
                                <div className='min-w-0'>
                                    <div className='flex items-start gap-2 text-sm font-semibold'>
                                        <Truck className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                                        <span className='break-words'>{shippingOptionLabel(option)}</span>
                                    </div>
                                    {duration && <div className='text-xs text-muted-foreground'>Estimasi {duration}</div>}
                                </div>
                            </div>
                            <div className='text-right shrink-0'>
                                {option.price > 0 ? (
                                    <span className='text-sm font-bold'>{priceToIDR(option.price)}</span>
                                ) : (
                                    <span className='font-semibold text-success'>GRATIS</span>
                                )}
                                {option.price > 0 && option.listPrice > option.price && (
                                    <div className='text-xs text-muted-foreground line-through'>{priceToIDR(option.listPrice)}</div>
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
