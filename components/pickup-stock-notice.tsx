"use client";

import React from "react";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { usePickupStock } from "../context/pickup-stock";
import { useCart } from "../context/cart";
import { Button } from "./ui/button";
import Link from "next/link";

/**
 * Shows what the chosen shop actually has, once a store is picked for
 * "Ambil di Toko".
 *
 * Every unavailable line is presented the same way, whether the branch is
 * genuinely out or the product is unknown to the POS: by decision the two count
 * as zero alike. All wording comes from the backend so the cart page and this
 * panel cannot drift apart.
 *
 * This panel only reports. Fixing the order — taking what the branch has, or
 * leaving a row out — happens on the rows themselves in the product list, at
 * the customer's own hand.
 */
const PickupStockNotice = ({ onChooseBranch }: { onChooseBranch?: () => void }) => {
    const { stock, loading, error, refresh } = usePickupStock();
    const { checkoutLines, excludedItemIds, qtyOverrides } = useCart();

    const adjusted = excludedItemIds.length + Object.keys(qtyOverrides).length;
    // Said whenever the order differs from the cart, including under the green
    // "all available" line — which is only true BECAUSE of the adjustment.
    // Leaving it unsaid would present a trimmed order as the whole cart.
    const adjustedNotice = adjusted > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
                <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                    Pesanan ini disesuaikan dengan stok toko:
                    {excludedItemIds.length > 0 && ` ${excludedItemIds.length} barang dikeluarkan`}
                    {excludedItemIds.length > 0 && Object.keys(qtyOverrides).length > 0 && ","}
                    {Object.keys(qtyOverrides).length > 0 && ` ${Object.keys(qtyOverrides).length} barang jumlahnya dikurangi`}
                    . Barang yang dikeluarkan tetap ada di keranjang sampai pesanan ini dibayar.
                </p>
            </div>
        </div>
    );

    const actions = (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/cart">Kembali ke keranjang</Link>
            </Button>
            {onChooseBranch && (
                <Button variant="outline" size="sm" className="h-8" onClick={onChooseBranch}>
                    Pilih cabang lain
                </Button>
            )}
            <Button variant="outline" size="sm" className="h-8" onClick={refresh}>
                Cek ulang
            </Button>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <Loader2Icon className="h-4 w-4 shrink-0 animate-spin" />
                <span>Mengecek ketersediaan barang di toko…</span>
            </div>
        );
    }

    if (checkoutLines.length === 0) {
        return (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                <div className="flex items-start gap-2">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">
                        Semua barang dikeluarkan dari pesanan. Masukkan kembali barang di daftar
                        produk, atau pilih cabang lain.
                    </p>
                </div>
                {actions}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="flex items-start gap-2 text-amber-900">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex-1">
                        <p className="font-medium">{error}</p>
                        <p className="mt-1 text-amber-800">
                            Kamu bisa mencoba lagi, memilih toko lain, atau menggunakan
                            pengiriman ke alamat.
                        </p>
                        {actions}
                    </div>
                </div>
            </div>
        );
    }

    if (!stock) return null;

    if (stock.canCheckout) {
        return (
            <div className="space-y-2">
                {adjustedNotice}
                <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
                    <CheckCircle2Icon className="h-4 w-4 shrink-0" />
                    <span>{stock.message}</span>
                </div>
            </div>
        );
    }

    const problems = stock.items.filter((i) => !i.sufficient);

    return (
        <div className="space-y-2">
            {adjustedNotice}
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
                <div className="flex items-start gap-2 text-red-900">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="font-medium">{stock.message}</p>
                </div>

                <ul className="mt-3 space-y-2">
                    {problems.map((item, index) => (
                        <li
                            key={`${item.productId}-${item.variationId ?? ""}-${index}`}
                            className="flex items-start gap-2 rounded border border-red-200 bg-white p-2"
                        >
                            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                            <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900">
                                    {item.name || "Barang di keranjang"}
                                </p>
                                <p className="text-red-700">{item.message}</p>
                            </div>
                        </li>
                    ))}
                </ul>

                {/* The fix is on the rows themselves; say where, or the customer
                    is left on a red panel with a disabled button and no idea
                    what to do next. */}
                <p className="mt-3 text-red-900">
                    Gunakan tombol <strong>Ambil</strong> atau <strong>Keluarkan</strong> pada
                    barang tersebut di daftar produk di bawah, lalu lanjutkan ke pembayaran.
                    Atau pilih cabang lain.
                </p>
                {actions}
            </div>
        </div>
    );
};

export default PickupStockNotice;
