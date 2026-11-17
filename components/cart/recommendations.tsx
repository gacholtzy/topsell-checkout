import React from "react"
import Link from "next/link"
import { priceToIDR } from "@/lib/helper"

export interface RecommendedProduct {
  slug: string
  name: string
  thumbnail?: string
  price?: string | number
  regularPrice?: string | number
}

/**
 * "Products you may like" as a plain scroll strip. Native horizontal scrolling
 * with snap points works with touch, trackpad and keyboard without a carousel
 * library, and nothing is clipped or hidden behind arrows.
 */
export function Recommendations({
  items,
  loading,
}: {
  items: RecommendedProduct[]
  loading: boolean
}) {
  return (
    <section aria-labelledby="reco-title" className="mt-10">
      <h2 id="reco-title" className="mb-3 text-lg font-bold">
        Mungkin Anda suka
      </h2>
      {loading ? (
        <p className="py-6 text-sm text-muted-foreground" role="status">Memuat rekomendasi…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada rekomendasi saat ini.</p>
      ) : (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {items.map((p, idx) => {
            const price = Number(p.price || 0)
            const regular = Number(p.regularPrice || 0)
            const saving = regular > 0 && regular !== price ? regular - price : 0
            return (
              <li key={`${p.slug}-${idx}`} className="w-[62%] shrink-0 snap-start sm:w-[32%] lg:w-[23.5%]">
                <Link
                  href={`https://topsellbelanja.com/product/${p.slug}`}
                  target="_blank"
                  className="group flex h-full flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-foreground/30"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbnail || "/images/placeholder-image.svg"}
                    alt=""
                    className="aspect-[4/3] w-full bg-secondary object-contain"
                  />
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="line-clamp-2 text-sm font-medium group-hover:underline">{p.name}</span>
                    <span className="mt-auto pt-1 text-base font-bold tabular-nums">{priceToIDR(price)}</span>
                    {saving > 0 && (
                      <span className="text-xs font-semibold text-success">Hemat {priceToIDR(saving)}</span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
