"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/lib/useAuthStore'
import { useToast } from '@/hooks/use-toast'
import { Star, Gift, XCircle, Plus, Minus, Clock, RotateCcw } from 'lucide-react'
import {
  getPointBalance,
  getPointHistory,
  getExpiringSoon,
  PointBalance,
  PointLedger,
  PointExpiringSoon,
} from '@/lib/points-utils'
import { dateStringToLocale } from '@/lib/helper'

const PAGE_SIZE = 10

const PointsPage = () => {
  const [balance, setBalance] = useState<PointBalance | null>(null)
  const [expiring, setExpiring] = useState<PointExpiringSoon | null>(null)
  const [ledger, setLedger] = useState<PointLedger[]>([])
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const { token } = useAuthStore()
  const { toast } = useToast()

  const fetchData = async (currentPage = 1) => {
    try {
      setLoading(true)
      if (!token) {
        setError("Silakan login untuk melihat poin Anda")
        return
      }
      const [bal, exp, hist] = await Promise.all([
        getPointBalance(token),
        getExpiringSoon(token),
        getPointHistory(token, currentPage, PAGE_SIZE),
      ])
      setBalance(bal)
      setExpiring(exp)
      setLedger(hist.data ?? [])
      setTotal(hist.total)
      setTotalPages(hist.totalPages)
      setError("")
    } catch (err) {
      console.error('Error fetching points:', err)
      setError(err instanceof Error ? err.message : 'Gagal memuat poin')
      toast({ title: 'Error', description: 'Gagal memuat data poin', variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page])

  const isCredit = (t: string) => t === 'earn'
  const ledgerMeta = (t: string) => {
    switch (t) {
      case 'earn':
        return { label: 'Poin Masuk', Icon: Plus, color: 'green' }
      case 'redeem':
        return { label: 'Tukar Poin', Icon: Gift, color: 'red' }
      case 'expire':
        return { label: 'Kedaluwarsa', Icon: Clock, color: 'gray' }
      case 'refund':
        return { label: 'Refund', Icon: RotateCcw, color: 'orange' }
      default:
        return { label: t, Icon: Star, color: 'gray' }
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="text-center py-12">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => fetchData(page)}>Coba Lagi</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Poin Saya</h1>
          <p className="text-gray-600">Pantau dan tukarkan poin reward Anda</p>
        </div>
        <Link href="/points/redeem">
          <Button className="gap-2">
            <Gift className="h-4 w-4" /> Tukar Poin
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Saldo Poin Aktif</CardTitle>
              <Star className="h-6 w-6 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {(balance?.activePoints ?? 0).toLocaleString('id-ID')}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Setara Rp{((balance?.activePoints ?? 0) * (balance?.pointToRupiah ?? 1)).toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Akan Kedaluwarsa</CardTitle>
              <Clock className="h-6 w-6 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {(balance?.expiringSoonPoints ?? expiring?.totalExpiring ?? 0).toLocaleString('id-ID')}
            </div>
            {expiring?.lots && expiring.lots.length > 0 ? (
              <p className="text-sm text-gray-500 mt-2">
                Tercepat hangus {dateStringToLocale(expiring.lots[0].expiresAt)}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-2">Tidak ada poin yang segera hangus</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Riwayat Poin</span>
            <span className="text-sm font-normal text-gray-500">Total: {total} aktivitas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length > 0 ? (
            <div className="space-y-2">
              {ledger.map((row) => {
                const meta = ledgerMeta(row.type)
                const credit = isCredit(row.type)
                return (
                  <div
                    key={row.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      credit ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${credit ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                        <meta.Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{row.description || meta.label}</p>
                        <p className="text-sm text-gray-500">{dateStringToLocale(row.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${credit ? 'text-green-600' : 'text-red-600'}`}>
                        {credit ? '+' : ''}{row.amount.toLocaleString('id-ID')}
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs">{meta.label}</Badge>
                    </div>
                  </div>
                )
              })}

              {totalPages > 1 && (
                <div className="mt-4 pt-4 border-t flex items-center justify-center gap-3 text-sm">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Sebelumnya
                  </Button>
                  <span className="text-gray-500">Halaman {page} dari {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Berikutnya
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada riwayat poin</p>
              <p className="text-sm">Mulai belanja untuk mendapatkan poin!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PointsPage
