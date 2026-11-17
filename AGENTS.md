<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Topsell Checkout — catatan proyek untuk agen/sesi baru

> Baca ini dulu. Isinya konteks yang sudah dianalisis, supaya tidak perlu menganalisis ulang dari nol.
> Perbarui bagian "Status" dan "Keputusan" di bawah saat ada perubahan besar.

## Apa ini

Custom checkout untuk **Topsell Belanja** (toko elektronik, WordPress/WooCommerce di `topsellbelanja.com`).
Pembeli menekan tombol "Beli" di WordPress → masuk ke checkout ini (Next.js) → login WhatsApp OTP → keranjang →
alamat + kurir (Biteship) → bayar (transfer manual / Midtrans Snap / QRIS) → lacak paket.

## Peta repo (semuanya terpisah dari repo produksi `store-topsell-next`)

| Folder | Repo GitHub | Isi |
|---|---|---|
| `D:\Topsell\topsell-checkout` (ini) | `gacholtzy/topsell-checkout` | Frontend Next.js 16 |
| `D:\Topsell\topsell-local-api` | `gacholtzy/topsell-api` | API tiruan Node (`node:http`), Neon Postgres, hosting Vercel |
| `D:\Topsell\topsell-direct-checkout` | — | Plugin WordPress (zip) yang mengarahkan tombol beli ke checkout ini |
| `D:\Topsell\security-audit\run-1` | — | Laporan audit keamanan (REPORT.md, FINDINGS-DETAIL.md, NEEDS-VALIDATION.md) |
| `D:\Topsell\store-topsell-next` | repo **produksi lama** | JANGAN diubah. Salinan lama, bukan sumber kebenaran |

Domain: frontend `https://topsell-checkout.vercel.app`, API `https://topsellbelanjaapi.vercel.app` (docs Scalar di `/docs`, pakai Basic Auth).

## Aturan kerja dengan pemilik proyek

- **Jangan `git commit` / `git push` kecuali diminta eksplisit.** Pemilik sering bilang "jangan commit apapun"; baru commit setelah "commit" / "push".
- Jangan memakai atau mengulang kredensial yang pernah ditempel di chat (Neon, consumer key WooCommerce, password docs). Anggap sudah bocor dan perlu diganti.
- Bahasa: Indonesia, ringkas, sederhana.
- Jangan menyentuh backend produksi (`api.topsellbelanja.com`). Pengembangan memakai API tiruan di `localhost:8080`.
- Uji UI di browser sungguhan (mobile 375/320, tablet 768, desktop), bukan hanya `tsc`.

## Menjalankan lokal

```bash
# 1. API (port 8080)   -> D:\Topsell\topsell-local-api
npm install && npm start            # butuh .env (DATABASE_URL, BITESHIP_API_KEY, DEV_MODE=true)
npm run check                       # selfcheck + securitycheck, harus "OK" semua

# 2. Frontend (port 3000) -> repo ini
cp .env.example .env.local          # API_URL / API_INTERNAL_URL / NEXT_PUBLIC_API_URL -> http://localhost:8080
npm install && npm run dev
```

Login lokal (API `DEV_MODE=true`): daftar dengan nomor apa saja, OTP **1234**.
Link beli contoh: `/add-to-cart?items=<base64 dari [{"productId":302375,"variationId":302376,"qty":1}]>`.
Produk nyata untuk uji: `302608`/var `302609` (Samsung A17), `302375`/var `302376` (iPhone 18 Pro) dari `www.topsellbelanja.com`.
Build: `npm run build` (`next.config.ts` memakai `ignoreBuildErrors`, jadi **jalankan `npx tsc --noEmit` sendiri**).

## Arsitektur singkat

- **Proxy:** browser memanggil `/backend/*` (rewrite di `next.config.ts` ke `API_URL`) atau `/api/*` (route handler Next yang meneruskan ke `API_INTERNAL_URL`). Token login ada di `localStorage` (`auth-storage`, Zustand, `lib/useAuthStore.ts`, versi 2).
- **Alur halaman**
  - `/add-to-cart` → menambah ke keranjang dari parameter `items` (base64), lalu `/cart`
  - `/cart` → pilih barang → "Checkout" → `/?cart=…` (**halaman checkout adalah `app/(page)/page.tsx`**, bukan `/order`)
  - `/manual?inv=` (transfer manual), `/qr-payment`, Midtrans (redirect), `/thankyou/[inv]`
  - `/order` = riwayat pesanan, `/tracking/[invoice]` = pelacakan Biteship, `/profil`, `/points`, `/voucher-saya`, `/auth`
- **State checkout** ada di `context/` (`cart`, `address`, `shipping`, `voucher`, `pickup-stock`); logika harga/ongkir/voucher/validasi stok ada di sana dan di `app/(page)/page.tsx` (`handleConfirmOrder`, `countGrandTotal`, `blockedReason`). Jangan ubah logika ini saat hanya merombak tampilan.
- Metode kirim: "Diantar ke Alamat" (area Topsell, kurir internal), "Ambil di Toko" (pilih cabang + cek stok cabang), "Pengiriman Reguler" (kurir Biteship). Daftar yang tampil difilter di `components/shipping-option.tsx`.
- Di model produk frontend, **`regularPrice` adalah harga jual dan `price` adalah harga coret** (penamaan terbalik; jangan "memperbaiki").
- `middleware.ts` melindungi `/api/cart*` (butuh header Authorization).

## UI / desain

UI memakai **BoardUI** (Tailwind v4 + React Aria, komponen disalin ke `components/base/*`), diberi warna merek merah dan font Plus Jakarta Sans. **Baca `DESIGN.md` sebelum mengubah UI**; aturan BoardUI untuk agen ada di bagian "BoardUI" di bawah berkas ini.
Halaman lama memanggil API shadcn lewat `components/ui/*` yang sekarang hanyalah lapisan kompatibilitas di atas BoardUI (button, input, dialog→Modal/Drawer, tabs, badge→Chip, toast). Kode baru: pakai langsung `components/base/*`.
Logo kurir di `public/images/couriers/` (jne.png, jnt.svg, jnt-cargo.png), dipetakan di `components/courier-options.tsx` (`courierLogo`); kurir tanpa logo tampil singkatan. Logo adalah merek dagang masing-masing kurir, dipakai hanya untuk mengenali kurir.
Logo pembayaran di `public/images/payments/` (bca, bni, mandiri, bri, permata, qris), dipilih dari `method.key` di `components/payment-mark.tsx` bila API hanya mengirim ikon placeholder; transfer manual dan bayar di toko memakai ikon bank/kartu. ShopeePay belum punya logo (tampil singkatan).
Komponen kustom: `components/checkout/section.tsx` (langkah bernomor), `components/cart/recommendations.tsx`.
Cara menambah komponen: `BOARDUI_TELEMETRY_DISABLED=1 npx boardui@latest add <nama> --yes` (CLI menulis berkas dan memasang dependensi; periksa `git status` sesudahnya). Hanya komponen gratis yang dipakai (jangan membeli/menyalin yang Pro).
Dev server: Next 16 menyimpan output dev di `.next/dev`, jadi `npm run build` aman dijalankan selagi `npm run dev` hidup.

## Keamanan (hasil audit, lihat `D:\Topsell\security-audit\run-1`)

- F-01 qty negatif, F-02 invoice acak (invoice baru 64-bit; yang lama masih bisa ditebak), F-03 injeksi path ID: **sudah diperbaiki di API** (commit `16f1fd3` repo API).
- Frontend: `npm audit fix` (Next 16.4.6, axios 1.21.1). Sisa: `zod` 3.x (butuh zod 4, ditunda), glob/minimatch/sucrase (tooling build).
- **Masih terbuka:** F-04 OTP satu kode bersama di mode hosting (masalah desain; jangan simpan data pelanggan nyata di API tiruan); NV-1 s.d. NV-7 (IP rate-limit di balik proxy, Biteship publik tanpa throttle, proxy `/api/proxy` tanpa allowlist, `dangerouslySetInnerHTML` dari app-settings di `app/layout.tsx`, header keamanan/CSP belum ada, rahasia di riwayat git).
- Turnstile: hapus `localhost` dari hostname yang diizinkan di produksi.

## Status (per 2026-11-17)

- API: fitur lengkap (login OTP, keranjang, checkout, voucher, poin, order, QR, tracking Biteship, docs Scalar). Commit terakhir `16f1fd3`.
- Frontend: redesain UI (versi shadcn) di-commit `a960271` di `main`. Perombakan ke **BoardUI** dikerjakan di branch lokal `boardui-ui` (belum di-commit; lihat `git status`). **Belum di-push**: `origin/main` punya satu commit `first commit` (akun galzzqt) berisi salinan lama proyek dengan riwayat tak berhubungan. Opsi: `git push --force-with-lease origin main` (menimpa) atau `git pull origin main --allow-unrelated-histories` lalu selesaikan konflik. Menunggu keputusan pemilik.
- Belum dicek mata setelah pindah ke BoardUI: `/qr-payment`, `/profil`, `/points`, `/voucher-saya`, `/add-to-cart`, dan kartu hasil pencarian alamat/toko (masih gaya lama). Sudah dicek: keranjang, checkout (alamat, kurir, pembayaran), login+OTP, pesanan, manual, thank-you, tracking.
- Data uji di Neon: akun `081200000099` dan beberapa pesanan `INV-LOCAL-*`; boleh dihapus.

## Yang masih perlu dilakukan pemilik

Push repo ke GitHub; isi env Vercel API (`WOO_URL`, `WOO_CONSUMER_KEY/SECRET`, `OTP_CODE`, `DOCS_USER/PASSWORD`, `DATABASE_URL`); ganti rahasia yang pernah bocor; deploy frontend dengan `API_URL`, `API_INTERNAL_URL`, `NEXT_PUBLIC_API_URL`; bandingkan `swagger/doc.json` backend produksi dengan API tiruan; uji plugin WordPress di staging.

<!-- boardui:rules:start -->
# BoardUI design rules

This project uses BoardUI (React + Tailwind CSS v4, source-owned components under `components/`). These rules always apply when writing UI code. MCP tools are on demand; these rules are not optional context.

## Components first

- Before hand-building any UI element, check for an installed BoardUI component under `components/base/` and `components/application/`, and prefer it.
- Missing a component? Install it (BoardUI MCP `install_components`, or `npx boardui@latest add <name>`) instead of writing a lookalike.
- Import through the `@/` alias, e.g. `import { Button } from "@/components/base/buttons/button"`.

## Color: semantic tokens only

- Never use raw palette classes (`text-gray-500`, `bg-white`, `border-neutral-200`) or hex/oklch literals. Every color rides a BoardUI semantic token, which also makes dark mode automatic.
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-placeholder`, errors `text-text-error-primary`.
- Surfaces: `bg-background-primary-default`, `bg-background-secondary-default` / `-hover`, `bg-background-tertiary-default`, page ground `bg-background-full`.
- Borders: `border-border-button-default` / `-hover`, hairlines `border-separator-border`, tables `border-border-table`, errors `border-border-error-default`.
- Icons: `text-foreground-icon-primary` through `text-foreground-icon-quaternary`.
- Charts: the `chart-1` … `chart-5` tokens (plus `-active` variants). CTAs and selection states: the `accent-50` … `accent-950` ramp.
- Dark mode flips tokens via the `.dark` class on `<html>`. Do not write `dark:` overrides with raw colors; if a token pair looks wrong in dark mode, pick a different token, not a literal.

## Typography: composite utilities only

- Use BoardUI's composite type utilities: `text-title-1-medium`, `text-title-2-medium`, `text-title-3-semibold`, `text-headline-medium`, `text-body-medium`, `text-body-regular`, `text-body-2-*`, `text-caption-1-semibold`, and friends. Each sets size, weight, line-height, and letter-spacing together.
- Never rebuild type by stacking `text-sm font-medium leading-5`; if a style seems missing, look in `styles/typography.css` before inventing one.

## Spacing and shape

- Stay on Tailwind's spacing scale (`gap-2`, `p-4`, `mt-6`); prefer flex/grid `gap` over per-child margins. Arbitrary values (`p-[13px]`) only when matching an existing BoardUI component exactly.
- Cards and panels: `rounded-3xl` with `border-border-button-default`. Inputs and menu rows: `rounded-md` to `rounded-xl`. Pills: `rounded-full`.

## Mechanics

- Direction: wrap the app (or a mixed-language region) in `DirectionProvider` from `@/components/foundations/direction/direction`, with an explicit BCP 47 `locale` (`ar`, `he`, `en-US`, `zh-CN`). Set matching `lang` and `dir` on `<html>` for full-app RTL. CSS `dir` alone does not configure React Aria keyboard navigation or portal placement. Use `useDirection()` for custom interactions and put its value on custom portal roots.
- Use logical styles: `ms`/`me`, `ps`/`pe`, `start`/`end`, `text-start`/`text-end`, `border-s`/`border-e`, `rounded-s`/`rounded-e`, and inline logical CSS properties. Mirror navigation/disclosure glyphs and horizontal drawer motion in RTL. Preserve physical coordinates for measured geometry, charts, canvas, and decorative art. Keep code, OTP digits, email addresses and URLs in explicit LTR regions; isolate mixed text with `<bdi>` or `dir="auto"`. Translating labels and formatting application data is separate from layout direction. See https://www.boardui.com/rtl.

- Internal vertical scroll regions must soften the top edge with a progressive blur and surface fade once scrolled, rather than sharply clipping content. Keep headers outside the scroll region. Use a stationary, `pointer-events-none`, `aria-hidden` overlay in a relative wrapper: a 24px masked 1px backdrop blur, a 16px masked 4px backdrop blur, and a gradient from the enclosing semantic surface token to transparent. Ramp each layer's opacity from 0 to 1 over the first 24px of scrolling; keep it invisible at scrollTop 0. Apply opacity to the individual layers, never the overlay parent (a translucent parent creates a backdrop root and can break blur at normal browser zoom). Verify top/reset, overflow, light/dark mode, and 100% zoom; preserve keyboard scrolling and do not blur the whole content area. The `scroll-fade` registry item ships this recipe as `ScrollFade` + `useScrollFade` (`@/components/foundations/scroll-fade/scroll-fade`); reuse it rather than rebuilding the layers.

- Merge classes with `cx()` from `@/utils/cx` (tailwind-merge aware of BoardUI's composite text styles). No string concatenation, no plain `clsx`.
- Icons come from `@remixicon/react`, passed as component references (`leadingIcon={RiAddLine}`), not rendered elements.
- Form components build on `react-aria-components`; extend the installed BoardUI form components rather than raw `<input>`/`<select>`.
- Focus states: `outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring`.

When unsure about a token, a component's API, or working example code, ask the BoardUI MCP server: `get_theme`, `get_component`, `get_usage_examples`.
<!-- boardui:rules:end -->
