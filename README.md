# Topsell Checkout

Custom checkout Topsell Belanja (Next.js).

Repo ini **terpisah dari repo produksi** (`store-topsell-next`). Tanpa env, frontend
mengarah ke API di `localhost:8080`, bukan backend produksi.

| Folder | Isi |
|---|---|
| `/` | Frontend Next.js (checkout, keranjang, pesanan, poin, tracking) |
| `docs/` | Analisis optimasi (PDF) |

## API

API tiruan untuk pengembangan ada di **repo terpisah**:
[`gacholtzy/topsell-api`](https://github.com/gacholtzy/topsell-api) (produk asli dari WooCommerce,
ongkir & tracking Biteship sandbox, data di Postgres, dokumentasi Scalar di `/docs`).
Cara menjalankan, env, dan pengaman hosting ada di repo itu.

## Menjalankan di lokal

```bash
# 1. API (port 8080): clone repo topsell-api, isi .env (DEV_MODE=true untuk tes lokal), lalu
npm install && npm start

# 2. Frontend (port 3000), di repo ini
cp .env.example .env.local
npm install
npm run dev
```

Login di API (dengan `DEV_MODE=true`): daftar akun dengan nomor apa saja, OTP **1234**.
Contoh link "Beli": `http://localhost:3000/add-to-cart?items=<base64 dari [{productId:271593,qty:1}]>`

## Deploy frontend

Isi build arg / env: `API_URL=https://<domain-api>/api/v1/:path*`, `API_INTERNAL_URL=https://<domain-api>`,
`NEXT_PUBLIC_API_URL=https://<domain-api>`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. `API_URL` dibaca saat `next build`.

## Tes

```bash
npx tsc --noEmit   # typecheck frontend
```
