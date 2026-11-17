# Topsell Checkout

Custom checkout Topsell Belanja (Next.js) beserta API lokal untuk pengembangan.

Repo ini **terpisah dari repo produksi** (`store-topsell-next`). Tanpa env, frontend
mengarah ke API lokal, bukan backend produksi.

| Folder | Isi |
|---|---|
| `/` | Frontend Next.js (checkout, keranjang, pesanan, poin, tracking) |
| `local-api/` | API tiruan untuk tes: produk asli dari WooCommerce, ongkir & tracking Biteship (sandbox), data di Postgres |
| `docs/` | Analisis optimasi (PDF) |

## Menjalankan di lokal

```bash
# 1. API lokal (port 8080)
cd local-api
cp .env.example .env      # isi DATABASE_URL & BITESHIP_API_KEY
npm install
npm start                 # dokumentasi API: http://localhost:8080/docs

# 2. Frontend (port 3000), di terminal lain
cp .env.example .env.local
npm install
npm run dev
```

Login di API lokal: daftar akun dengan nomor apa saja, OTP selalu **1234**.
Contoh link "Beli": `http://localhost:3000/add-to-cart?items=<base64 dari [{productId:271593,qty:1}]>`

## Tes

```bash
cd local-api && npm run check   # self-check semua alur (butuh .env)
npx tsc --noEmit                # typecheck frontend
```

## Penting

`local-api` **bukan backend produksi**: OTP tetap, pembayaran tiruan, dan endpoint
`/dev/*` tanpa login. Jangan dibuka ke internet tanpa pembatasan akses.
