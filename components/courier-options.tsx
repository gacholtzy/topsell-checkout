"use client"
import React from 'react'
import { useShipping } from '../context/shipping'
import { priceToIDR } from '../lib/helper'
import { shippingOptionDuration, shippingOptionLabel } from '../interface/shipping'
import { Skeleton } from './ui/skeleton'
import { RadioGroup } from '@/components/base/radio/radio'
import { RadioCard } from '@/components/base/radio/radio-card'
import { Chip } from '@/components/base/badges/chip'

/**
 * The courier services Biteship offers for the saved address, one per row.
 * Which couriers appear is decided in the Biteship dashboard; this only shows
 * what came back, cheapest first, and lets the customer pick one.
 */
const keyOf = (o: { courierCode: string; courierServiceCode: string }) => `${o.courierCode}|${o.courierServiceCode}`

const CourierOptions = () => {
    const { shippingOptions, shippingOptionsLoading, shippingOptionsError, selectedShippingOption, selectShippingOption } = useShipping()

    if (shippingOptionsLoading && shippingOptions.length === 0) {
        return (
            <div className='mt-4 space-y-2' role='status' aria-label='Memuat pilihan kurir'>
                <Skeleton className='h-14 w-full' />
                <Skeleton className='h-14 w-full' />
            </div>
        )
    }

    if (shippingOptionsError && shippingOptions.length === 0) {
        return <p className='mt-4 text-body-medium text-text-error-primary' role='alert'>{shippingOptionsError}</p>
    }

    if (shippingOptions.length === 0) return null

    return (
        <div className='mt-5'>
            <RadioGroup
                aria-label='Pilih kurir'
                value={selectedShippingOption ? keyOf(selectedShippingOption) : ''}
                onChange={(value) => {
                    const next = shippingOptions.find((o) => keyOf(o) === value)
                    if (next) selectShippingOption(next)
                }}
                className={shippingOptionsLoading ? 'opacity-60' : undefined}
            >
                <p className='mb-1 text-body-semibold text-text-primary'>Pilih kurir</p>
                {shippingOptions.map((option) => {
                    const duration = shippingOptionDuration(option)
                    return (
                        <RadioCard
                            key={keyOf(option)}
                            value={keyOf(option)}
                            title={
                                <span className='flex min-w-0 items-baseline justify-between gap-3'>
                                    <span className='truncate'>{shippingOptionLabel(option)}</span>
                                    <span className='shrink-0 tabular-nums'>
                                        {option.price > 0 ? priceToIDR(option.price) : <Chip variant='caption' color='lime'>Gratis</Chip>}
                                    </span>
                                </span>
                            }
                            description={
                                <>
                                    {duration ? `Estimasi ${duration}` : 'Estimasi tidak tersedia'}
                                    {option.price > 0 && option.listPrice > option.price && (
                                        <span className='ms-2 line-through'>{priceToIDR(option.listPrice)}</span>
                                    )}
                                </>
                            }
                        />
                    )
                })}
            </RadioGroup>
        </div>
    )
}

export default CourierOptions
