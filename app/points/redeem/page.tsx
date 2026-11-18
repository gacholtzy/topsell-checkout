"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/useAuthStore'
import { useToast } from '@/hooks/use-toast'
import { useGlobalDialog } from '@/components/global/useGlobalDialog'
import { Gift, Star, XCircle, ArrowLeft, Loader2 } from 'lucide-react'
import {
  getPointBalance,
  getRedeemCatalog,
  redeemPoint,
  PointBalance,
  RedeemCatalogItem,
} from '@/lib/points-utils'
import { priceToIDR } from '@/lib/helper'

const RedeemPage = () => {
  const [balance, setBalance] = useState<PointBalance | null>(null)
  const [items, setItems] = useState<RedeemCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const { token } = useAuthStore()
  const { toast } = useToast()
  const router = useRouter()
  const { showConfirmDialog, showAlertDialog } = useGlobalDialog()

  const fetchData = async () => {
    try {
      setLoading(true)
      if (!token) {
        setError("Silakan login untuk menukar poin")
        return
      }
      const [bal, catalog] = await Promise.all([
        getPointBalance(token),
        getRedeemCatalog(token),
      ])
      setBalance(bal)
      setItems(catalog)
      setError("")
    } catch (err) {
      console.error('Error fetching redeem catalog:', err)
      setError(err instanceof Error ? err.message : 'Gagal memuat katalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // confirmRedeem asks the user to confirm before spending points (guards
  // against accidental taps), then performs the redemption.
  const confirmRedeem = (item: RedeemCatalogItem) => {
    showConfirmDialog({
      title: 'Konfirmasi Penukaran',
      message: `Tukar ${item.pointCost.toLocaleString('id-ID')} poin dengan voucher "${item.name}"?`,
      confirmLabel: 'Tukar',
      cancelLabel: 'Batal',
      onConfirm: () => handleRedeem(item),
    })
  }

  const handleRedeem = async (item: RedeemCatalogItem) => {
    if (!token) return
    try {
      setRedeemingId(item.id)
      await redeemPoint(token, item.id)
      // refresh balance
      const bal = await getPointBalance(token)
      setBalance(bal)
      showAlertDialog({
        iconType: 'success',
        title: 'Penukaran Berhasil',
        message:
          'Penukaran poin dengan voucher telah berhasil, klik tombol berikut untuk mengecek voucher yang kamu miliki saat ini',
        buttonLabel: 'Lihat Voucher',
        onClose: () => router.push('/voucher-saya'),
      })
    } catch (err) {
      toast({
        title: 'Gagal menukar poin',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan',
        variant: "destructive",
      })
    } finally {
      setRedeemingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
          <p className="text-primary mb-4">{error}</p>
          <Button onClick={fetchData}>Coba Lagi</Button>
        </div>
      </div>
    )
  }

  const activePoints = balance?.activePoints ?? 0

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/points">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tukar Poin</h1>
            <p className="text-muted-foreground text-sm">Tukarkan poin Anda dengan voucher belanja</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-warning-soft px-4 py-2">
          <Star className="h-5 w-5 text-warning" />
          <span className="font-bold text-warning">{activePoints.toLocaleString('id-ID')}</span>
          <span className="text-sm text-muted-foreground">poin</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Belum ada voucher yang bisa ditukar saat ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => {
            const enough = activePoints >= item.pointCost
            const busy = redeemingId === item.id
            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Gift className="h-8 w-8 text-primary" />
                    <Badge variant="secondary">{item.pointCost.toLocaleString('id-ID')} poin</Badge>
                  </div>
                  <CardTitle className="text-lg mt-2">{item.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-2xl font-bold text-success">{priceToIDR(item.discountValue)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Nilai potongan voucher</p>
                  {item.minTransaction > 0 && (
                    <p className="text-xs text-gray-400 mt-2">Min. transaksi {priceToIDR(item.minTransaction)}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Berlaku {item.validityDays} hari setelah ditukar</p>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={!enough || busy}
                    onClick={() => confirmRedeem(item)}
                  >
                    {busy ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses...</>
                    ) : enough ? (
                      'Tukar Sekarang'
                    ) : (
                      'Poin tidak cukup'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RedeemPage
