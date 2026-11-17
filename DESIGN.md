# Topsell Checkout — Design

UI memakai **BoardUI** (https://boardui.com): komponen disalin ke repo sebagai source (React 19 + Tailwind v4 + React Aria), lalu diberi warna merek Topsell dan font Plus Jakarta Sans. Mode desain: **Operate** (aplikasi yang dipakai cepat, kebanyakan di ponsel). Ukuran keberhasilan: pembeli langsung tahu langkah berikutnya.

## Pondasi

| Hal | Di mana |
|---|---|
| Tailwind v4 (`@tailwindcss/postcss`) | `postcss.config.mjs`, `app/globals.css` |
| Token & tipografi BoardUI | `styles/theme.css`, `styles/typography.css`, `styles/globals.css` (jangan diedit tanpa alasan; disalin dari `npx boardui init`) |
| Warna merek | `app/globals.css` → `@theme { --color-accent-50…950 }` (600 = merah merek `#cc1926`). Seluruh tombol utama, fokus, checkbox, radio, tab ikut. |
| Font | Plus Jakarta Sans lewat `next/font` (`--font-jakarta` di `<html>`), dipasang ke `--font-sans` |
| Token lama (shadcn) | `tailwind.config.ts` dimuat lewat `@config`; nilainya (`--background`, `--card`, `--border`, …) di `app/globals.css` sudah diarahkan ke netral BoardUI. Dipakai oleh halaman yang belum dipindah. Jangan menambah pemakaian baru. |
| Util | `utils/cx.ts` (tailwind-merge yang paham gaya teks BoardUI) — pakai `cx()`, bukan `clsx` |
| Ikon | `@remixicon/react` (BoardUI). `lucide-react` masih ada di halaman lama. |

Komponen BoardUI ada di `components/base/*`, `components/foundations/*` (jangan diedit sembarangan; perbarui dengan `npx boardui@latest add <nama> --overwrite`, set `BOARDUI_TELEMETRY_DISABLED=1`). Terpasang: button, link-button, icon-button, close-button, input, textarea, checkbox, checkbox-card, radio, radio-card, select, modal, drawer, popover, dropdown, tabs, chip, counter, divider, breadcrumb, number-field, spinner, skeleton, toast, input-otp, accordion, tooltip, avatar, status-dot, search-field.

## Lapisan kompatibilitas (`components/ui/*`)

Halaman lama tetap memanggil API shadcn; isinya sekarang BoardUI:

| `components/ui/…` | Dirender dengan |
|---|---|
| `button` (`variant`, `size`, `asChild`) | `components/base/buttons/button` (default→primary, destructive→danger, outline/secondary→secondary, ghost/link→ghost). Target 44px di ponsel. |
| `input`, `textarea` | `InputBase`, `TextareaBase` (field terisi, ring saat fokus). Props `<input>` biasa, jadi react-hook-form tetap jalan. Awalan seperti `+62` lewat `leadingAddon`. |
| `dialog`, `alert-dialog` | `Modal` (layar ≥640px) dan `Drawer` bawah / bottom sheet (ponsel). `DialogContent` punya `hideClose` dan `dismissable`. Jangan beri kelas ukuran ke `DialogContent`. |
| `tabs` | `Tabs` BoardUI (garis bawah, bisa digeser ke samping) |
| `badge` | `Chip` |
| `use-toast` / `toast()` | `toast()` BoardUI; `<Toaster />` dipasang di `app/layout.tsx`. Pesan identik saling menggantikan. |

Kode baru sebaiknya langsung memakai komponen `components/base/*`.

## Pola layar

- **Checkout** (`app/(page)/page.tsx`): `Breadcrumb` → 3 langkah bernomor (`components/checkout/section.tsx`) → ringkasan menempel di kanan (≥`lg`). Metode pengiriman dan kurir adalah `RadioGroup` + `RadioCard`. Tombol "Konfirmasi Pesanan" yang nonaktif selalu menyebut alasannya (`blockedReason`). Di ponsel, total + tombol ada di bar bawah (menumpuk di <400px).
- **Keranjang**: `Checkbox`, `NumberField` untuk jumlah, strip rekomendasi geser.
- **Login**: `InputOtp` 4 digit, tab garis bawah.
- Wadah utama `rounded-3xl border border-border-button-default bg-background-full`. Tipografi memakai utilitas komposit (`text-title-1-semibold`, `text-headline-semibold`, `text-body-regular`, `text-caption-1-regular`).

## Aturan

- Warna lewat token semantik BoardUI (`text-text-primary`, `text-text-secondary`, `bg-background-secondary-default`, `border-border-button-default`, `text-status-lime-text`…). Tidak ada warna mentah (`gray-500`, hex).
- Satu aksen (merah merek) untuk aksi utama dan pilihan aktif; hijau (`lime`) hanya untuk "gratis/selesai/hemat".
- Jangan menumpuk kartu di dalam kartu; pisahkan dengan garis tipis.
- Harga: `tabular-nums`, jangan dipotong; nomor invoice dan nama kurir boleh turun baris.
- Kontras teks ≥4,5:1, target sentuh ≥44px di ponsel, `prefers-reduced-motion` dihormati.
- Uji di 320, 375, 768, dan desktop; tidak boleh ada geser horizontal halaman.
