"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/useAuthStore'
import { getMyVouchers, MyVoucher } from '@/lib/points-utils'
import { priceToIDR, dateStringToLocale } from '@/lib/helper'
import { voucherDiscountLabel, voucherEndDate, voucherScopeLabel } from '@/lib/voucher-display'
import { Ticket, ArrowLeft, XCircle } from 'lucide-react'

const VoucherSayaPage = () => {
  const [vouchers, setVouchers] = useState<MyVoucher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const { token } = useAuthStore()

  const fetchData = async () => {
    try {
      setLoading(true)
      if (!token) {
        setError("Silakan login untuk melihat voucher Anda")
        return
      }
      const data = await getMyVouchers(token)
      setVouchers(data)
      setError("")
    } catch (err) {
      console.error('Error fetching vouchers:', err)
      setError(err instanceof Error ? err.message : 'Gagal memuat voucher')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/points">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Voucher Saya</h1>
          <p className="text-muted-foreground text-sm">Voucher aktif yang kamu miliki saat ini</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
          <p className="text-primary mb-4">{error}</p>
          <Button onClick={fetchData}>Coba Lagi</Button>
        </div>
      ) : vouchers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Belum ada voucher aktif. Tukarkan poin kamu untuk mendapatkan voucher.</p>
          <Link href="/points/redeem">
            <Button className="mt-4">Tukar Poin</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {vouchers.map((voucher) => (
            <Card key={voucher.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Ticket className="h-8 w-8 text-primary" />
                  <Badge variant="secondary">Aktif</Badge>
                </div>
                <CardTitle className="text-lg mt-2">{voucher.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-2xl font-bold text-success">{voucherDiscountLabel(voucher)}</p>
                <p className="text-sm text-muted-foreground mt-1">Nilai potongan voucher</p>
                {voucherScopeLabel(voucher) && (
                  <Badge variant="outline" className="mt-2">{voucherScopeLabel(voucher)}</Badge>
                )}
                {voucher.minTransaction > 0 && (
                  <p className="text-xs text-gray-400 mt-2">Min. transaksi {priceToIDR(voucher.minTransaction)}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Berlaku s/d {dateStringToLocale(voucherEndDate(voucher))}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default VoucherSayaPage
