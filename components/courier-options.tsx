"use client"
import React from 'react'
import { useShipping } from '../context/shipping'
import { priceToIDR } from '../lib/helper'
import { shippingOptionDuration } from '../interface/shipping'
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

/**
 * The courier's logo, picked from what Biteship calls it. JNE Trucking and the
 * other JNE services share the JNE mark; J&T Cargo has its own. Couriers
 * without a file here fall back to their initials.
 */
function courierLogo(o: { courierCode: string; courierServiceCode: string; courierServiceName: string }) {
    const code = o.courierCode.toLowerCase()
    const service = `${o.courierServiceCode} ${o.courierServiceName}`.toLowerCase()
    if (code.includes('jne')) return '/images/couriers/jne.png'
    if (code.includes('jnt') || code.includes('j&t')) {
        return code.includes('cargo') || service.includes('cargo') ? '/images/couriers/jnt-cargo.png' : '/images/couriers/jnt.svg'
    }
    return null
}

/** "JNE" + "JNE Trucking" reads "JNE JNE Trucking"; say it once. */
function courierText(o: { courierName: string; courierServiceName: string }) {
    const name = (o.courierName || '').trim()
    const service = (o.courierServiceName || '').trim()
    return service.toLowerCase().startsWith(name.toLowerCase()) ? service : [name, service].filter(Boolean).join(' ')
}

function CourierMark({ option }: { option: { courierCode: string; courierName: string; courierServiceCode: string; courierServiceName: string } }) {
    const src = courierLogo(option)
    return (
        <span className='flex h-9 w-14 shrink-0 items-center justify-center rounded-lg border border-border-button-default bg-background-full p-1.5' aria-hidden='true'>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt='' loading='lazy' decoding='async' className='max-h-full max-w-full object-contain' />
            ) : (
                <span className='text-caption-1-semibold text-text-secondary'>{(option.courierName || '?').slice(0, 3).toUpperCase()}</span>
            )}
        </span>
    )
}

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
                                <span className='flex min-w-0 items-center gap-3'>
                                    <CourierMark option={option} />
                                    <span className='flex min-w-0 flex-1 items-baseline justify-between gap-3'>
                                    <span className='truncate'>{courierText(option)}</span>
                                    <span className='shrink-0 tabular-nums'>
                                        {option.price > 0 ? priceToIDR(option.price) : <Chip variant='caption' color='lime'>Gratis</Chip>}
                                    </span>
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
