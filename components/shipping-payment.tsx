import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import ShippingOption from './shipping-option'
import PaymentOption from './payment-option'

const ShippingAndPayment = () => {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Metode Pengiriman</CardTitle>
            </CardHeader>
            <CardContent>
                <ShippingOption />
                <CardHeader className='px-0'>
                    <CardTitle>Metode Pembayaran</CardTitle>
                </CardHeader>
                <PaymentOption />
            </CardContent>
        </Card>
    )
}

export default ShippingAndPayment