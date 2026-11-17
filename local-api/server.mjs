// API lokal tiruan untuk store-topsell-next:
// tahap 1: add-to-cart -> login -> keranjang -> checkout (alamat, ongkir, voucher, toko).
// tahap 2: riwayat order, QR payment, poin & tukar poin, voucher saya, email & validasi email.
//
// - Produk: data ASLI dari WooCommerce Store API publik (tanpa key), di-cache di memori.
// - User, sesi login, keranjang, dan order disimpan di Postgres (DATABASE_URL, mis. Neon).
//   Tabel dibuat otomatis saat server start.
// - OTP tidak dikirim: kodenya selalu 1234. Captcha diabaikan.
// - Tidak ada payment gateway: checkout hanya membuat order lokal.
//
// Jalankan: node server.mjs   (PORT default 8080, WOO_URL bisa diganti lewat env)

import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

// .env di folder ini (opsional), mis. BITESHIP_API_KEY=biteship_test...
const ENV_FILE = new URL("./.env", import.meta.url);
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const PORT = Number(process.env.PORT || 8080);
const BITESHIP_KEY = process.env.BITESHIP_API_KEY || "";
const WOO = process.env.WOO_URL || "https://www.topsellbelanja.com/wp-json/wc/store/v1";
export const OTP_CODE = "1234"; // frontend memakai OTP 4 digit

// ---------------------------------------------------------------- database (Postgres)
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi di .env");
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const q = async (sql, params) => (await pool.query(sql, params)).rows;

/** Dibuat sekali saat start; aman dijalankan berulang. */
export const dbReady = pool.query(`
  create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null default '',
    phone_number text not null unique,
    points integer not null default 0,
    created_at timestamptz not null default now()
  );
  create table if not exists sessions (
    token text primary key,
    user_id uuid not null references users(id) on delete cascade,
    created_at timestamptz not null default now()
  );
  create table if not exists cart_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    product_id text not null,
    variation_id text not null default '',
    qty integer not null check (qty > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, product_id, variation_id)
  );
  create table if not exists orders (
    id uuid primary key,
    invoice text not null unique,
    user_id uuid not null references users(id) on delete cascade,
    data jsonb not null,
    created_at timestamptz not null default now()
  );
  create index if not exists orders_user_created on orders (user_id, created_at desc);

  -- tahap 2: validasi email, poin (buku besar), voucher milik user
  alter table users add column if not exists email_valid boolean not null default false;
  alter table users add column if not exists email_token text;
  create table if not exists point_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    type text not null,              -- earn | redeem | expire | refund
    amount integer not null,         -- earn positif, redeem negatif
    balance_after integer not null,
    description text not null,
    created_at timestamptz not null default now()
  );
  create index if not exists point_ledger_user on point_ledger (user_id, created_at desc);
  create table if not exists user_vouchers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    name text not null,
    description text not null,
    discount integer not null,
    min_transaction integer not null default 0,
    start_date timestamptz not null default now(),
    end_date timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
  );
  -- user dari tahap 1 punya poin di kolom users.points tapi belum di buku besar
  insert into point_ledger (user_id, type, amount, balance_after, description)
    select u.id, 'earn', u.points, u.points, 'Bonus member baru' from users u
    where u.points > 0 and not exists (select 1 from point_ledger p where p.user_id = u.id);
`);

/** Jalankan fn(client) dalam satu transaksi; gagal di tengah = tidak ada yang berubah. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// Saldo poin = jumlah buku besar (satu sumber kebenaran, users.points tidak dipakai lagi).
const POINTS_SQL = `(select coalesce(sum(amount), 0) from point_ledger p where p.user_id = u.id)::int`;
const USER_COLS = `u.id, u.full_name as "fullName", u.email, u.phone_number as "phoneNumber",
  u.email_valid as "isEmailValid", ${POINTS_SQL} as points`;
// Order pending lebih dari 24 jam dianggap kedaluwarsa (batas bayar).
const ORDER_STATUS_SQL = `case when data->>'status' = 'pending' and created_at < now() - interval '24 hours'
  then 'expired' else data->>'status' end`;
const CART_COLS = `id, product_id as "productId", variation_id as "variationId", qty`;
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s));

const findUserByPhone = async (phone) =>
  (await q(`select ${USER_COLS} from users u where u.phone_number = $1`, [phone]))[0];
const getCart = (userId) =>
  q(`select ${CART_COLS} from cart_items where user_id = $1 order by created_at`, [userId]);
async function getCartItem(userId, id) {
  const row = isUuid(id) && (await q(`select ${CART_COLS} from cart_items where user_id = $1 and id = $2`, [userId, id]))[0];
  if (!row) throw new HttpError(404, "Item tidak ditemukan");
  return row;
}

// ---------------------------------------------------------------- data statis
const SHIPPING_METHODS = [
  { id: "1", title: "Pengiriman Reguler", description: "Dikirim lewat kurir ekspedisi", order: 1 },
  { id: "2", title: "Diantar ke Alamat", description: "Diantar kurir Topsell (area Topsell)", order: 2 },
  { id: "3", title: "Ambil di Toko", description: "Ambil sendiri di cabang Topsell", order: 3 },
];
const PICKUP_ID = "3";

const ICON = "/images/placeholder-image.svg";
const pm = (id, key, name, adminFee = 0, adminFeeType = "fixed") =>
  ({ id, key, name, description: name, excerpt: name, icon: ICON, adminFee, adminFeeType });
const PAYMENT_GROUPS = [
  { name: "Transfer Bank", key: "bank", paymentMethods: [pm("pm-manual", "manual", "Transfer Manual")] },
  { name: "Virtual Account", key: "va", paymentMethods: [pm("pm-bca", "bca", "BCA Virtual Account", 4000), pm("pm-bni", "bni", "BNI Virtual Account", 4000)] },
  { name: "QRIS", key: "qris", paymentMethods: [pm("pm-qris", "qris", "QRIS", 0.7, "percentage")] },
  { name: "Bayar di Toko", key: "store", paymentMethods: [pm("pm-cc", "cc", "Tunai / Debit / Kartu Kredit di Toko")] },
];
for (const g of PAYMENT_GROUPS) for (const m of g.paymentMethods) m.paymentGroup = { name: g.name, key: g.key };
const PAYMENT_METHODS = PAYMENT_GROUPS.flatMap((g) => g.paymentMethods);

const STORES = [
  { id: "store-sda", name: "Topsell Sidoarjo", address: "Jl. Ahmad Yani No. 1, Sidoarjo", storeArea: { name: "Sidoarjo", cityIds: [] } },
  { id: "store-mlg", name: "Topsell Malang", address: "Jl. Ijen No. 10, Malang", storeArea: { name: "Malang", cityIds: [] } },
  { id: "store-gsk", name: "Topsell Gresik", address: "Jl. Veteran No. 5, Gresik", storeArea: { name: "Gresik", cityIds: [] } },
];

// [id, kecamatan, kota, provinsi, kodepos, area Topsell?]
const AREAS = [
  ["IDNP11IDNC149IDND1001", "Sidoarjo", "Sidoarjo", "Jawa Timur", "61219", true],
  ["IDNP11IDNC149IDND1002", "Waru", "Sidoarjo", "Jawa Timur", "61256", true],
  ["IDNP11IDNC149IDND1003", "Buduran", "Sidoarjo", "Jawa Timur", "61252", true],
  ["IDNP11IDNC150IDND2001", "Klojen", "Malang", "Jawa Timur", "65111", true],
  ["IDNP11IDNC150IDND2002", "Lowokwaru", "Malang", "Jawa Timur", "65141", true],
  ["IDNP11IDNC151IDND3001", "Gresik", "Gresik", "Jawa Timur", "61111", true],
  ["IDNP11IDNC152IDND4001", "Mojokerto", "Mojokerto", "Jawa Timur", "61311", true],
  ["IDNP11IDNC153IDND5001", "Gubeng", "Surabaya", "Jawa Timur", "60281", false],
  ["IDNP11IDNC153IDND5002", "Wonokromo", "Surabaya", "Jawa Timur", "60243", false],
  ["IDNP6IDNC457IDND6001", "Kebayoran Baru", "Jakarta Selatan", "DKI Jakarta", "12120", false],
  ["IDNP9IDNC23IDND7001", "Coblong", "Bandung", "Jawa Barat", "40132", false],
].map(([id, sub, city, prov, zip, inArea]) => ({
  id, inArea,
  row: { id, label: `${sub}, ${city}, ${prov}. ${zip}`, province_name: prov, city_name: city, district_name: sub, subdistrict_name: sub, zip_code: zip },
}));
// Area Topsell per 3 digit awal kode pos: Gresik 611, Sidoarjo 612, Mojokerto 613,
// Jombang 614, Kediri 641, Malang 651, Tulungagung 662.
// ponytail: perkiraan per prefix, bukan daftar kode pos resmi Topsell; ganti dengan daftar asli bila ada.
const TOPSELL_POSTAL_PREFIXES = ["611", "612", "613", "614", "641", "651", "662"];
const isTopsellPostal = (postal) => TOPSELL_POSTAL_PREFIXES.some((p) => String(postal || "").startsWith(p));

/** Cari kecamatan di Biteship Maps API; tanpa key pakai daftar contoh AREAS. */
const areaSearchCache = new Map();
async function searchAreas(q, limit) {
  if (!BITESHIP_KEY) {
    return AREAS.filter((a) => a.row.label.toLowerCase().includes(q.toLowerCase())).slice(0, limit).map((a) => a.row);
  }
  if (!areaSearchCache.has(q)) {
    const url = `https://api.biteship.com/v1/maps/areas?countries=ID&type=single&input=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Authorization: BITESHIP_KEY }, signal: AbortSignal.timeout(10000) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) throw new HttpError(502, `Biteship: ${body?.error || res.status}`);
    areaSearchCache.set(q, (body.areas || []).map((a) => ({
      id: a.id,
      label: a.name,
      province_name: a.administrative_division_level_1_name,
      city_name: a.administrative_division_level_2_name,
      district_name: a.administrative_division_level_3_name,
      subdistrict_name: a.administrative_division_level_3_name,
      zip_code: String(a.postal_code ?? ""),
    })));
  }
  return areaSearchCache.get(q).slice(0, limit);
}

// Kecamatan untuk pemilih alamat dua langkah tim. Biteship mengulang kecamatan per kode pos
// (id ...IDZ<kodepos>); di sini dikelompokkan per kecamatan, kode posnya disimpan untuk langkah 2.
// ponytail: tanpa indeks Permendagri seperti backend tim — daftar kecamatan terbatas pada hasil Biteship.
const districtPostal = new Map(); // id kecamatan -> baris area lengkap dengan kode pos
const districtIdOf = (id) => String(id).replace(/IDZ\d+$/, "");
async function searchDistricts(term, limit) {
  const districts = new Map();
  for (const r of await searchAreas(term, 100)) {
    const id = districtIdOf(r.id);
    const known = districtPostal.get(id) || [];
    if (!known.some((x) => x.id === r.id)) known.push(r);
    districtPostal.set(id, known);
    if (!districts.has(id)) {
      districts.set(id, { ...r, id, zip_code: "", label: `${r.district_name}, ${r.city_name}, ${r.province_name}` });
    }
  }
  return [...districts.values()].slice(0, limit);
}

const VOUCHERS = [
  { id: "v-hemat10", name: "HEMAT10", type: "percent", description: "Diskon 10% maks. Rp50.000", minTransaction: 100000, discount: 10, maxDiscount: 50000, fulfillmentType: "all" },
  { id: "v-potong100", name: "POTONG100", type: "fixed", description: "Potongan Rp100.000 min. belanja Rp3.000.000", minTransaction: 3000000, discount: 100000, maxDiscount: 0, fulfillmentType: "all" },
  { id: "v-pickup25", name: "PICKUP25", type: "fixed", description: "Potongan Rp25.000 khusus Ambil di Toko", minTransaction: 0, discount: 25000, maxDiscount: 0, fulfillmentType: "pickup" },
  { id: "v-ongkir", name: "GRATISONGKIR", type: "shipping", description: "Gratis ongkir s/d Rp20.000", minTransaction: 0, discount: 20000, maxDiscount: 0, fulfillmentType: "delivery", isAutoApply: true },
].map((v) => ({
  qty: 100, usedQty: 0, productIDs: [], paymentMethodIDs: [], variationIDs: [], isCancellable: true, isAutoApply: false,
  startDate: "2026-01-01T00:00:00+07:00", endDate: "2026-12-31T23:59:59+07:00", ...v,
}));

// ---------------------------------------------------------------- WooCommerce (data produk asli)
const wooCache = new Map(); // ponytail: cache tanpa kedaluwarsa, restart server untuk menyegarkan
async function woo(path) {
  if (wooCache.has(path)) return wooCache.get(path);
  const res = await fetch(`${WOO}${path}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new HttpError(502, `WooCommerce ${res.status} untuk ${path}`);
  const json = await res.json();
  wooCache.set(path, json);
  return json;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Produk dalam bentuk yang dibaca frontend. price = harga coret, regularPrice = harga jual. */
async function loadProduct(productId, variationId) {
  const p = await woo(`/products/${productId}`);
  const v = variationId ? await woo(`/products/${variationId}`) : null;
  const src = v || p;
  return {
    id: String(p.id),
    name: p.name,
    slug: p.slug,
    price: Number(src.prices.regular_price),
    regularPrice: Number(src.prices.price),
    categories: (p.categories || []).map((c) => ({ id: String(c.id), name: c.name })),
    images: (p.images || []).map((i) => ({ id: String(i.id), name: i.name, src: i.src, alt: i.alt })),
    variationName: v ? String(v.variation || "").split(":").pop().trim() : "",
    variationId: v ? String(v.id) : "",
    sku: src.sku || "",
    inStock: !!src.is_in_stock,
  };
}

// ---------------------------------------------------------------- helpers
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const ok = (res, data, message = "OK") => send(res, 200, { status: 200, message, data });

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, "Body bukan JSON yang valid"); }
}

const normPhone = (p) => String(p || "").replace(/\D/g, "").replace(/^0/, "62");

async function authUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const [user] = token
    ? await q(`select ${USER_COLS} from users u join sessions s on s.user_id = u.id where s.token = $1`, [token])
    : [];
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

/** Hash kecil supaya stok cabang acak tapi konsisten per produk. */
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

async function cartItemView(row) {
  const p = await loadProduct(row.productId, row.variationId);
  return {
    id: row.id, productId: row.productId, variationId: row.variationId, qty: row.qty,
    price: String(p.regularPrice), regularPrice: String(p.price),
    name: p.variationName ? `${p.name} - ${p.variationName}` : p.name,
    stock: p.inStock ? 99 : 0, stockStatus: p.inStock ? "instock" : "outofstock",
    images: p.images,
  };
}

/** Baris checkout dari body: [{id, qty?}] atau [{cartID}]. */
async function linesFromBody(user, data) {
  const cart = await getCart(user.id);
  const lines = [];
  for (const d of data || []) {
    const id = d.id || d.cartID;
    const row = cart.find((r) => r.id === id);
    if (!row) continue;
    const qty = d.qty && d.qty < row.qty ? d.qty : row.qty;
    lines.push({ row, qty, product: await loadProduct(row.productId, row.variationId) });
  }
  return lines;
}
const subtotalOf = (lines) => lines.reduce((s, l) => s + l.product.regularPrice * l.qty, 0);

// Ongkir luar area dari tarif kurir Biteship (POST /v1/rates/couriers), kurir termurah dipilih.
const ORIGIN_POSTAL = process.env.BITESHIP_ORIGIN_POSTAL_CODE || "61219"; // gudang asal, default Sidoarjo
const COURIERS = process.env.BITESHIP_COURIERS || "jne,jnt,sicepat,anteraja";
// ponytail: Woo Store API tidak memberi berat produk, jadi semua barang dianggap seberat ini.
// Barang besar (kulkas, TV) jadi kemurahan; ganti dengan berat asli dari Woo REST (butuh key) bila perlu.
const ITEM_WEIGHT_GRAMS = Number(process.env.DEFAULT_ITEM_WEIGHT_GRAMS || 1000);
const FLAT_OUTSIDE_AREA = 20000; // dipakai bila BITESHIP_API_KEY kosong

const rateCache = new Map();
/**
 * Semua layanan kurir untuk alamat + isi paket, termurah dulu — kontrak tim:
 * POST /shippings/options -> ShippingOption[] (interface/shipping.ts di frontend).
 * price = yang dibayar user (0 di area Topsell: disubsidi), listPrice = tarif asli kurir.
 * items: [{ name, value, qty }].
 */
async function shippingOptions(postalCode, items) {
  if (!postalCode) throw new HttpError(400, "Kode pos tujuan wajib diisi");
  let list;
  if (!BITESHIP_KEY) {
    list = [{ courierCode: "jnt", courierName: "J&T", courierServiceCode: "ez", courierServiceName: "EZ",
      serviceType: "standard", shippingType: "parcel", duration: "2 - 3 days", listPrice: FLAT_OUTSIDE_AREA }];
  } else {
    const body = JSON.stringify({
      origin_postal_code: Number(ORIGIN_POSTAL),
      destination_postal_code: Number(postalCode),
      couriers: COURIERS,
      items: items.map((i) => ({ name: i.name, value: i.value, weight: ITEM_WEIGHT_GRAMS, quantity: i.qty })),
    });
    if (!rateCache.has(body)) {
      const data = await biteship("/v1/rates/couriers", { method: "POST", body });
      rateCache.set(body, (data.pricing || []).filter((p) => p.price > 0).map((p) => ({
        courierCode: p.courier_code, courierName: p.courier_name,
        courierServiceCode: p.courier_service_code, courierServiceName: p.courier_service_name,
        serviceType: p.service_type || "", shippingType: p.shipping_type || "", duration: p.duration || "",
        listPrice: p.price,
      })));
    }
    list = rateCache.get(body);
  }
  const free = isTopsellPostal(postalCode);
  return list
    .map((o) => ({ ...o, price: free ? 0 : o.listPrice, freeArea: free }))
    .sort((a, b) => a.price - b.price || a.listPrice - b.listPrice);
}

/**
 * Ongkir satu layanan: yang dipilih user (pick = { courierCode, courierServiceCode }),
 * atau termurah bila belum memilih. 0 untuk Ambil di Toko.
 * Mengembalikan { price, courier } — courier dipakai saat memesan kurir di Biteship.
 */
async function shippingQuote(postalCode, shippingID, items, pick = {}) {
  if (shippingID === PICKUP_ID) return { price: 0, courier: null };
  const options = await shippingOptions(postalCode, items);
  const picked = pick.courierCode
    ? options.find((o) => o.courierCode === pick.courierCode && o.courierServiceCode === pick.courierServiceCode)
    : options[0];
  if (!picked) {
    throw new HttpError(400, pick.courierCode
      ? "Layanan kurir yang dipilih tidak tersedia lagi untuk alamat ini"
      : "Tidak ada kurir yang melayani alamat ini");
  }
  return {
    price: picked.price,
    courier: { company: picked.courierCode, type: picked.courierServiceCode, name: picked.courierName, serviceName: picked.courierServiceName },
  };
}
const shippingCost = async (...args) => (await shippingQuote(...args)).price;

// ---------------------------------------------------------------- Biteship: pengiriman & tracking
// Data pengirim untuk order pengiriman Biteship. ponytail: default data contoh; isi data gudang asli di .env.
const SHIPPER = {
  name: process.env.SHIPPER_NAME || "Topsell Belanja",
  phone: process.env.SHIPPER_PHONE || "081234567890",
  email: process.env.SHIPPER_EMAIL || "toko@topsell.test",
  address: process.env.ORIGIN_ADDRESS || "Jl. Ahmad Yani No. 1, Sidoarjo",
};
const COURIER_NAMES = { jne: "JNE", jnt: "J&T Express", sicepat: "SiCepat", anteraja: "AnterAja" };

async function biteship(path, init = {}) {
  const res = await fetch(`https://api.biteship.com${path}`, {
    ...init,
    headers: { Authorization: BITESHIP_KEY, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) throw new HttpError(502, `Biteship: ${data?.error || res.status}`);
  return data;
}

// Status Biteship (snake_case) -> camelCase seperti backend tim, plus label untuk user.
const toCamel = (s) => String(s || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const BITESHIP_LABELS = {
  confirmed: "Pesanan dikonfirmasi, menunggu kurir",
  scheduled: "Penjemputan dijadwalkan",
  allocated: "Kurir ditugaskan",
  pickingUp: "Kurir menuju lokasi penjemputan",
  picked: "Paket dijemput kurir",
  droppingOff: "Paket dalam perjalanan ke alamat",
  returnInTransit: "Paket dalam perjalanan kembali",
  onHold: "Pengiriman ditahan",
  delivered: "Paket diterima",
  rejected: "Pengiriman ditolak",
  courierNotFound: "Kurir tidak ditemukan",
  returned: "Paket dikembalikan",
  cancelled: "Pengiriman dibatalkan",
  disposed: "Paket dimusnahkan",
};
const biteshipLabel = (status) => BITESHIP_LABELS[status] || status;

/**
 * Pesan kurir di Biteship untuk order ini (backend tim: setelah dibayar).
 * Hasil: field order versi tim — biteshipTrackingID, resi, status + label, dan
 * trackingUrl ke halaman tracking milik frontend (/tracking/<invoice>).
 */
async function bookShipment(order) {
  const courier = order.courier || { company: "jnt", type: "ez" };
  const postal = order.destinationPostalCode || order.address?.match(/\b\d{5}\b(?!.*\b\d{5}\b)/)?.[0];
  const data = await biteship("/v1/orders", {
    method: "POST",
    body: JSON.stringify({
      reference_id: order.invoice,
      shipper_contact_name: SHIPPER.name, shipper_contact_phone: SHIPPER.phone,
      shipper_contact_email: SHIPPER.email, shipper_organization: SHIPPER.name,
      origin_contact_name: SHIPPER.name, origin_contact_phone: SHIPPER.phone,
      origin_address: SHIPPER.address, origin_postal_code: Number(ORIGIN_POSTAL),
      destination_contact_name: order.name, destination_contact_phone: order.phone,
      destination_contact_email: order.email, destination_address: order.address,
      destination_postal_code: Number(postal),
      courier_company: courier.company, courier_type: courier.type, delivery_type: "now",
      items: order.products.map((p) => ({
        name: p.name, description: p.variant || p.name, value: p.regularPrice, quantity: p.qty, weight: ITEM_WEIGHT_GRAMS,
      })),
    }),
  });
  const status = toCamel(data.status);
  return {
    biteshipOrderID: data.id,
    biteshipTrackingID: data.courier.tracking_id,
    biteshipLink: data.courier.link || "",
    biteshipStatus: status,
    biteshipStatusLabel: biteshipLabel(status),
    courierCompany: data.courier.company,
    courierName: COURIER_NAMES[data.courier.company] || courier.name || data.courier.company,
    trackingNumber: data.courier.waybill_id || "",
    trackingUrl: `/tracking/${order.invoice}`,
  };
}
const rateItems = (lines) => lines.map((l) => ({ name: l.product.name, value: l.product.regularPrice, qty: l.qty }));

function voucherDiscount(v, subtotal, ongkir) {
  if (!v || subtotal < v.minTransaction) return 0;
  if (v.type === "shipping") return Math.min(v.discount, ongkir);
  if (v.type === "percent") return Math.min(Math.round((subtotal * v.discount) / 100), v.maxDiscount || Infinity);
  return Math.min(v.discount, subtotal);
}

// --- voucher milik user (hasil tukar poin)
const userVoucherView = (r) => ({
  id: r.id, name: r.name, type: "fixed", description: r.description,
  minTransaction: r.min_transaction, discount: r.discount, maxDiscount: 0,
  qty: 1, usedQty: 0, productIDs: [], paymentMethodIDs: [], variationIDs: [],
  isCancellable: true, isAutoApply: false, fulfillmentType: "all",
  startDate: r.start_date, endDate: r.end_date,
});
const myVouchers = async (userId) => (await q(
  `select * from user_vouchers where user_id = $1 and used_at is null and end_date > now() order by created_at desc`,
  [userId]
)).map(userVoucherView);
/** Voucher global atau voucher milik user ini yang belum dipakai. */
async function findVoucher(userId, id) {
  if (!id) return null;
  return VOUCHERS.find((v) => v.id === id)
    || (isUuid(id) && (await myVouchers(userId)).find((v) => v.id === id))
    || null;
}

// --- poin
const POINT_TO_RUPIAH = 1;
const NEW_MEMBER_POINTS = 20000;
const REDEEM_CATALOG = [
  { id: "cat-10k", name: "Voucher Rp10.000", pointCost: 10000, discountValue: 10000, status: "active", validityDays: 30, minTransaction: 100000 },
  { id: "cat-25k", name: "Voucher Rp25.000", pointCost: 25000, discountValue: 25000, status: "active", validityDays: 30, minTransaction: 500000 },
];
const pointBalance = async (db, userId) =>
  (await db.query(`select coalesce(sum(amount), 0)::int as n from point_ledger where user_id = $1`, [userId])).rows[0].n;

// --- order (untuk riwayat & QR)
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
// Link tombol "Lacak" untuk kurir ekspedisi; {resi} diganti nomor resi.
// ponytail: resi lokal tiruan, jadi situs lacak akan bilang "tidak ditemukan"; di backend asli link dibuat per kurir.
const TRACKING_URL = process.env.TRACKING_URL_TEMPLATE || "https://cekresi.com/?noresi={resi}";
function orderView(row) {
  const o = { ...row.data, status: row.status };
  if (o.status === "pending") {
    o.paymentSecondsLeft = Math.max(0, row.secs);
    o.paymentUrl = o.paymentMethod?.key === "qris" ? `/qr-payment?inv=${encodeURIComponent(o.invoice)}` : "";
  }
  return o;
}

function voucherList(type, subtotal, shippingID, extra = []) {
  const isPickup = shippingID === PICKUP_ID;
  return [...VOUCHERS, ...extra]
    .filter((v) => (type === "shipping") === (v.type === "shipping"))
    .map((v) => {
      const fits = v.fulfillmentType === "all" || (v.fulfillmentType === "pickup") === isPickup;
      const reason = !fits ? (isPickup ? "Khusus Diantar ke Alamat" : "Khusus Ambil di Toko")
        : subtotal < v.minTransaction ? `Minimal belanja Rp${v.minTransaction.toLocaleString("id-ID")}` : "";
      return { ...v, isEligible: !reason, ineligibleReason: reason || undefined };
    });
}

/** Stok satu cabang untuk baris keranjang. storeIndex -1 = gudang online. */
function branchStock(storeIndex, rows) {
  const store = STORES[storeIndex];
  const items = rows.map(({ row, qty, product }) => {
    const h = hash(row.productId + (row.variationId || ""));
    const available = !product.inStock ? 0 : storeIndex < 0 ? 99 : [10, h % 3, 0][storeIndex] ?? 0;
    const sufficient = available >= qty;
    return {
      itemId: row.id, productId: row.productId, variationId: row.variationId || undefined, sku: product.sku,
      name: product.variationName ? `${product.name} - ${product.variationName}` : product.name,
      requested: qty, available, sufficient, unresolved: false,
      message: sufficient ? "" : available === 0 ? "Stok habis di cabang ini" : `Hanya tersedia ${available} unit di cabang ini`,
    };
  });
  const complete = items.every((i) => i.sufficient);
  return {
    branchCode: store ? store.id.toUpperCase() : "ONLINE",
    branchId: storeIndex + 1,
    branchName: store ? store.name : "Gudang Online",
    items, complete, canCheckout: complete,
    message: complete ? "Semua barang tersedia" : "Sebagian barang tidak cukup stoknya",
  };
}

async function stockRows(user, url) {
  const cart = await getCart(user.id);
  const ids = (url.searchParams.get("itemIds") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const qtys = (url.searchParams.get("qtys") || "").split(",").map(Number);
  const rows = ids.length ? ids.map((id) => cart.find((r) => r.id === id)).filter(Boolean) : cart;
  return Promise.all(rows.map(async (row, i) => ({
    row, qty: qtys[i] > 0 ? qtys[i] : row.qty, product: await loadProduct(row.productId, row.variationId),
  })));
}

// ---------------------------------------------------------------- routes
// [method, regex atas path setelah /api/v1, handler(req, res, match, url)]
const routes = [
  ["GET", /^\/app-settings$/, (req, res) =>
    ok(res, { id: "local", banner_imager: [], meta_your_pixel: "", body_script: "" })],

  // --- produk
  ["GET", /^\/products\/(\d+)$/, async (req, res, m, url) => {
    const variationId = url.searchParams.get("variation_id");
    const p = await loadProduct(m[1], variationId);
    // Untuk variasi, frontend membaca data.name sebagai nama variasi.
    ok(res, variationId ? { ...p, name: p.variationName } : p);
  }],
  ["GET", /^\/(carts\/)?recommendations$/, async (req, res) => {
    const list = await woo("/products?per_page=8");
    ok(res, list.map((p) => ({
      thumbnail: p.images?.[0]?.src || "", slug: p.slug, name: p.name,
      price: p.prices.regular_price, regularPrice: p.prices.price,
    })));
  }],

  // --- user / login OTP
  ["POST", /^\/users\/register$/, async (req, res) => {
    const b = await readBody(req);
    const phoneNumber = normPhone(b.phoneNumber);
    if (!phoneNumber || !b.fullName) throw new HttpError(400, "Nama dan nomor HP wajib diisi");
    // User baru + bonus poin member baru di buku besar, sekaligus.
    const [created] = await q(
      `with u as (
         insert into users (full_name, email, phone_number) values ($1, $2, $3)
         on conflict (phone_number) do nothing returning id
       )
       insert into point_ledger (user_id, type, amount, balance_after, description)
       select id, 'earn', $4, $4, 'Bonus member baru' from u returning user_id`,
      [b.fullName, b.email || "", phoneNumber, NEW_MEMBER_POINTS]
    );
    if (!created) throw new HttpError(409, "Nomor sudah terdaftar, silakan login");
    ok(res, null, `OTP terkirim (lokal: ${OTP_CODE})`);
  }],
  ["POST", /^\/users\/(login|resend-otp)$/, async (req, res) => {
    const phoneNumber = normPhone((await readBody(req)).phoneNumber);
    if (!(await findUserByPhone(phoneNumber))) throw new HttpError(404, "Nomor belum terdaftar, silakan daftar dulu");
    ok(res, null, `OTP terkirim (lokal: ${OTP_CODE})`);
  }],
  ["POST", /^\/users\/verify-otp$/, async (req, res) => {
    const b = await readBody(req);
    const user = await findUserByPhone(normPhone(b.phoneNumber));
    if (!user) throw new HttpError(404, "Nomor belum terdaftar");
    if (String(b.otp) !== OTP_CODE) throw new HttpError(400, "Kode OTP salah");
    const token = crypto.randomBytes(24).toString("hex");
    await q(`insert into sessions (token, user_id) values ($1, $2)`, [token, user.id]);
    ok(res, { token, user }, "Login berhasil");
  }],
  ["GET", /^\/users\/(me|profile)$/, async (req, res) => ok(res, await authUser(req))],

  // --- keranjang
  ["GET", /^\/carts$/, async (req, res) => {
    const user = await authUser(req);
    const items = await Promise.all((await getCart(user.id)).map(cartItemView));
    ok(res, { id: `cart-${user.id}`, userId: user.id, items, createdAt: "", updatedAt: "" });
  }],
  ["DELETE", /^\/carts$/, async (req, res) => {
    await q(`delete from cart_items where user_id = $1`, [(await authUser(req)).id]);
    ok(res, null, "Cart cleared successfully");
  }],
  ["POST", /^\/carts\/items$/, async (req, res) => {
    const user = await authUser(req);
    const b = await readBody(req);
    const productId = String(b.productId || "");
    const variationId = String(b.variationId || "");
    const qty = Number(b.qty) || 1;
    if (!productId) throw new HttpError(400, "productId wajib diisi");
    if (!(qty >= 1)) throw new HttpError(400, "qty minimal 1");
    await loadProduct(productId, variationId); // produk yang tidak ada -> 502, seperti backend asli
    // Produk + variasi yang sama ditambah qty-nya, bukan baris baru (atomic di database).
    const [row] = await q(
      `insert into cart_items (user_id, product_id, variation_id, qty) values ($1, $2, $3, $4)
       on conflict (user_id, product_id, variation_id)
       do update set qty = cart_items.qty + excluded.qty, updated_at = now()
       returning ${CART_COLS}`,
      [user.id, productId, variationId, qty]
    );
    send(res, 200, { status: 201, message: "Item added to cart successfully", data: { ...row, userId: user.id } });
  }],
  ["GET", /^\/carts\/items\/([\w-]+)$/, async (req, res, m) => {
    const row = await getCartItem((await authUser(req)).id, m[1]);
    const p = await loadProduct(row.productId, row.variationId);
    ok(res, { ...p, qty: row.qty });
  }],
  ["PUT", /^\/carts\/items\/([\w-]+)$/, async (req, res, m) => {
    const user = await authUser(req);
    await getCartItem(user.id, m[1]);
    const qty = Number((await readBody(req)).qty);
    if (!(qty >= 1)) throw new HttpError(400, "qty minimal 1");
    const [row] = await q(
      `update cart_items set qty = $1, updated_at = now() where id = $2 returning ${CART_COLS}`, [qty, m[1]]
    );
    ok(res, row, "Cart item updated successfully");
  }],
  ["DELETE", /^\/carts\/items\/([\w-]+)$/, async (req, res, m) => {
    const user = await authUser(req);
    if (isUuid(m[1])) await q(`delete from cart_items where user_id = $1 and id = $2`, [user.id, m[1]]);
    ok(res, null, "Cart item removed successfully");
  }],

  // --- stok cabang
  ["GET", /^\/carts\/stock$/, async (req, res, m, url) => {
    const rows = await stockRows(await authUser(req), url);
    const storeId = url.searchParams.get("storeId");
    const idx = storeId ? STORES.findIndex((s) => s.id === storeId) : -1;
    if (storeId && idx < 0) throw new HttpError(404, "Toko tidak ditemukan");
    ok(res, branchStock(idx, rows));
  }],
  ["GET", /^\/carts\/stock\/branches$/, async (req, res, m, url) => {
    const rows = await stockRows(await authUser(req), url);
    ok(res, STORES.map((s, i) => {
      const stock = branchStock(i, rows);
      const availableItems = stock.items.filter((it) => it.sufficient).length;
      return {
        storeId: s.id, storeName: s.name, areaName: s.storeArea.name, address: s.address, branchCode: stock.branchCode,
        available: availableItems > 0, availableItems, totalItems: stock.items.length, reachable: true,
        missingItems: stock.items.filter((it) => !it.sufficient), unmonitoredItems: 0, stock,
      };
    }));
  }],

  // --- alamat, pembayaran, toko
  ["GET", /^\/address\/search$/, async (req, res, m, url) => {
    const q = (url.searchParams.get("search") || "").trim();
    const limit = Number(url.searchParams.get("limit")) || 20;
    if (q.length < 3) return ok(res, []);
    // mode=local: langkah 1 pemilih alamat tim (daftar kecamatan, tanpa kode pos).
    ok(res, url.searchParams.get("mode") === "local" ? await searchDistricts(q, limit) : await searchAreas(q, limit));
  }],
  // Langkah 2 pemilih alamat tim: kode pos untuk kecamatan yang dipilih.
  // ?area_id=<id kecamatan> atau ?district=&city=&province= (nama dari indeks lokal).
  ["GET", /^\/address\/postal-codes$/, async (req, res, m, url) => {
    let areaId = url.searchParams.get("area_id");
    if (!areaId) {
      const district = (url.searchParams.get("district") || "").trim();
      const city = (url.searchParams.get("city") || "").trim();
      if (!district) throw new HttpError(400, "area_id atau district wajib diisi");
      const same = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
      const match = (await searchDistricts(`${district} ${city}`.trim(), 50))
        .find((d) => same(d.district_name, district) && (!city || same(d.city_name, city)));
      if (!match) throw new HttpError(404, "Kecamatan ini belum dikenali oleh layanan kurir. Coba pilih kecamatan terdekat.");
      areaId = match.id;
    }
    const rows = districtPostal.get(areaId);
    if (!rows) throw new HttpError(404, "Kecamatan tidak ditemukan. Coba cari dan pilih kecamatan lagi.");
    ok(res, [...rows].sort((a, b) => a.zip_code.localeCompare(b.zip_code)));
  }],
  ["GET", /^\/address\/store$/, (req, res, m, url) => {
    const q = (url.searchParams.get("search") || "").toLowerCase();
    ok(res, STORES.filter((s) => `${s.name} ${s.address}`.toLowerCase().includes(q)));
  }],
  ["GET", /^\/address\/payment$/, (req, res) => ok(res, PAYMENT_GROUPS)],
  ["GET", /^\/topsell-area-postal\/check-postal-code-is-exist\/(\w+)$/, (req, res, m) => ok(res, isTopsellPostal(m[1]))],

  // --- ongkir
  ["GET", /^\/shippings\/methods$/, (req, res) => ok(res, SHIPPING_METHODS)],
  ["POST", /^\/shippings\/price$/, async (req, res, m, url) => {
    const b = await readBody(req);
    const items = await Promise.all((b.product_ids_and_quantities || []).map(async (i) => {
      const p = await loadProduct(i.id, i.variationId);
      return { name: p.name, value: p.regularPrice, qty: Number(i.quantity) || 1 };
    }));
    ok(res, await shippingCost(url.searchParams.get("postal_code"), null, items));
  }],
  // Pemilih kurir (components/courier-options.tsx): semua layanan, termurah dulu.
  ["POST", /^\/shippings\/options$/, async (req, res, m, url) => {
    const b = await readBody(req);
    const items = await Promise.all((b.product_ids_and_quantities || []).map(async (i) => {
      const p = await loadProduct(i.id, i.variationId);
      return { name: p.name, value: p.regularPrice, qty: Number(i.quantity) || 1 };
    }));
    ok(res, await shippingOptions(url.searchParams.get("postal_code"), items));
  }],

  // --- voucher
  ["POST", /^\/vouchers\/all$/, async (req, res, m, url) => {
    const user = await authUser(req);
    const b = await readBody(req);
    const type = url.searchParams.get("voucher_type");
    const subtotal = subtotalOf(await linesFromBody(user, b.data));
    ok(res, voucherList(type, subtotal, b.shippingID, type === "shipping" ? [] : await myVouchers(user.id)));
  }],
  ["POST", /^\/vouchers\/validate$/, async (req, res, m, url) => {
    const user = await authUser(req);
    const b = await readBody(req);
    const v = await findVoucher(user.id, url.searchParams.get("voucherID"));
    if (!v) throw new HttpError(404, "Voucher tidak ditemukan");
    const lines = await linesFromBody(user, b.data);
    const ongkir = v.type === "shipping"
      ? await shippingCost(b.postalCode, b.shippingID, rateItems(lines), { courierCode: b.courierCode, courierServiceCode: b.courierServiceCode })
      : 0;
    ok(res, voucherDiscount(v, subtotalOf(lines), ongkir));
  }],

  // --- checkout & order
  ["POST", /^\/checkout$/, async (req, res) => {
    const user = await authUser(req);
    const b = await readBody(req);
    const lines = await linesFromBody(user, b.cartItems);
    if (!lines.length) throw new HttpError(400, "Keranjang kosong atau item tidak ditemukan");
    const shipping = SHIPPING_METHODS.find((s) => s.id === b.shippingID);
    const paymentMethod = PAYMENT_METHODS.find((p) => p.id === b.paymentMethodID);
    if (!shipping || !paymentMethod) throw new HttpError(400, "Metode pengiriman/pembayaran tidak valid");
    const area = shipping.id === PICKUP_ID ? STORES.find((s) => s.id === b.areaID) : null;
    if (shipping.id === PICKUP_ID && !area) throw new HttpError(400, "Pilih toko untuk Ambil di Toko");

    const subtotal = subtotalOf(lines);
    // Ongkir dihitung ulang di server untuk layanan kurir yang dipilih user (bukan angka dari browser).
    const { price: ongkir, courier } = await shippingQuote(b.postalCode, shipping.id, rateItems(lines),
      { courierCode: b.courierCode, courierServiceCode: b.courierServiceCode });
    const voucher = await findVoucher(user.id, b.voucherID);
    const shipVoucher = await findVoucher(user.id, b.shippingVoucherID);
    const discount = voucherDiscount(voucher, subtotal, ongkir) + voucherDiscount(shipVoucher, subtotal, ongkir);
    const adminFee = paymentMethod.adminFeeType === "percentage"
      ? Math.round((paymentMethod.adminFee / 100) * (subtotal + ongkir)) : paymentMethod.adminFee;

    const invoice = `INV-LOCAL-${Date.now().toString(36).toUpperCase()}`;
    const order = {
      id: crypto.randomUUID(), invoice, userId: user.id,
      name: b.name, email: b.email, phone: b.phone, address: b.address,
      total: subtotal + ongkir - discount + adminFee, ongkir, adminFee,
      voucherID: b.voucherID || "", voucher, voucherDiscount: discount,
      paymentMethodID: paymentMethod.id, paymentMethod, shippingID: shipping.id, shipping,
      products: lines.map(({ product: p, qty }) => ({
        id: p.id, name: p.name, price: p.price, regularPrice: p.regularPrice, categories: p.categories,
        images: p.images, variant: p.variationName, weight: 1, qty,
      })),
      status: "pending", bankAccountName: b.bankAccountName || "", bankAccountNumber: b.bankAccountNumber || "",
      createdAt: new Date().toISOString(), areaID: area?.id || "", area,
      // untuk memesan kurir Biteship setelah dibayar
      destinationPostalCode: b.postalCode || "", courier,
      courierCompany: courier?.company || "",
      courierName: courier ? (COURIER_NAMES[courier.company] || courier.name) : "",
      courierServiceName: courier?.serviceName || b.courierServiceName || "",
    };
    // Order + pengurangan keranjang dalam satu transaksi: gagal di tengah = tidak ada yang berubah.
    // Baris yang dibeli keluar dari keranjang (qty dikurangi bila dibeli sebagian);
    // baris yang dikeluarkan di langkah pickup juga dibersihkan, sesuai CheckoutRequest.
    const excluded = (b.excludedCartItems || []).map((e) => e.id).filter(isUuid);
    await tx(async (client) => {
      await client.query(`insert into orders (id, invoice, user_id, data) values ($1, $2, $3, $4)`,
        [order.id, invoice, user.id, order]);
      for (const { row, qty } of lines) {
        if (qty >= row.qty) await client.query(`delete from cart_items where id = $1`, [row.id]);
        else await client.query(`update cart_items set qty = qty - $1, updated_at = now() where id = $2`, [qty, row.id]);
      }
      if (excluded.length) {
        await client.query(`delete from cart_items where user_id = $1 and id = any($2::uuid[])`, [user.id, excluded]);
      }
      // Voucher hasil tukar poin hanya sekali pakai; dua checkout bersamaan tidak bisa memakainya dua kali.
      if (voucher && isUuid(voucher.id)) {
        const used = await client.query(
          `update user_vouchers set used_at = now() where id = $1 and user_id = $2 and used_at is null`, [voucher.id, user.id]);
        if (!used.rowCount) throw new HttpError(400, "Voucher sudah dipakai");
      }
    });

    const redirectURL = paymentMethod.key === "manual" ? `/manual?inv=${invoice}`
      : paymentMethod.key === "qris" ? `/qr-payment?inv=${invoice}`
      : `/thankyou/${invoice}`;
    send(res, 200, { status: 200, message: "Checkout berhasil", redirectURL, data: order });
  }],
  ["GET", /^\/orders$/, async (req, res, m, url) => {
    const [row] = await q(`select data, ${ORDER_STATUS_SQL} as status from orders where invoice = $1`,
      [url.searchParams.get("invoice")]);
    if (!row) throw new HttpError(404, "Order tidak ditemukan");
    ok(res, { ...row.data, status: row.status });
  }],
  ["GET", /^\/orders\/history$/, async (req, res, m, url) => {
    const user = await authUser(req);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
    const rows = await q(
      `select data, ${ORDER_STATUS_SQL} as status,
              extract(epoch from (created_at + interval '24 hours' - now()))::int as secs,
              count(*) over ()::int as total
         from orders
        where user_id = $1 and ${ORDER_STATUS_SQL} = $2
        order by created_at desc limit $3 offset $4`,
      [user.id, url.searchParams.get("status") || "pending", limit, (page - 1) * limit]
    );
    const total = rows[0]?.total ?? 0;
    send(res, 200, { status: 200, message: "OK", data: rows.map(orderView), total, totalPage: Math.ceil(total / limit) });
  }],
  ["GET", /^\/orders\/qr-code$/, async (req, res, m, url) => {
    const [row] = await q(`select data, ${ORDER_STATUS_SQL} as status from orders where invoice = $1`,
      [url.searchParams.get("invoice")]);
    if (!row) throw new HttpError(404, "Order tidak ditemukan");
    if (row.data.paymentMethod?.key !== "qris") throw new HttpError(400, "Order ini tidak dibayar dengan QRIS");
    // ponytail: string tiruan, bukan QRIS yang bisa dibayar; payment gateway asli ada di backend.
    ok(res, {
      invoice: row.data.invoice, amount: row.data.total, status: row.status, paymentType: "QRIS",
      qrString: `TOPSELL-LOCAL-QRIS|${row.data.invoice}|${row.data.total}`,
    });
  }],
  // Halaman /tracking/[invoice] milik tim: ringkasan order + riwayat langsung dari Biteship.
  // Kontrak sama dengan backend tim: GET /api/v1/orders/tracking?invoice=...
  ["GET", /^\/orders\/tracking$/, async (req, res, m, url) => {
    const user = await authUser(req);
    const [row] = await q(`select data, ${ORDER_STATUS_SQL} as status from orders where invoice = $1 and user_id = $2`,
      [url.searchParams.get("invoice"), user.id]);
    if (!row) throw new HttpError(404, "Order tidak ditemukan");
    const o = row.data;
    if (!o.biteshipTrackingID) throw new HttpError(404, "Pelacakan belum tersedia untuk pesanan ini");
    const t = await biteship(`/v1/trackings/${encodeURIComponent(o.biteshipTrackingID)}`);
    const status = toCamel(t.status);
    // Simpan status terbaru supaya label di daftar Pesanan ikut terbaru.
    if (status !== o.biteshipStatus || (t.waybill_id && t.waybill_id !== o.trackingNumber)) {
      await q(`update orders set data = data || $1::jsonb where invoice = $2`, [
        { biteshipStatus: status, biteshipStatusLabel: biteshipLabel(status), trackingNumber: t.waybill_id || o.trackingNumber || "" },
        o.invoice,
      ]);
    }
    ok(res, {
      invoice: o.invoice,
      orderStatus: row.status,
      courierCompany: o.courierCompany || t.courier?.company || "",
      courierName: o.courierName || "",
      courierServiceName: o.courierServiceName || "",
      waybillId: t.waybill_id || o.trackingNumber || "",
      biteshipStatus: status,
      biteshipLabel: biteshipLabel(status),
      link: t.link || o.biteshipLink || "",
      driverName: t.courier?.driver_name || undefined,
      driverPhone: t.courier?.driver_phone || undefined,
      driverPlateNumber: t.courier?.driver_plate_number || undefined,
      originAddress: t.origin?.address || "",
      destinationAddress: t.destination?.address || "",
      history: (t.history || []).map((h) => {
        const st = toCamel(h.status);
        return { status: st, label: biteshipLabel(st), note: h.note, updatedAt: h.updated_at };
      }),
    });
  }],
  // Khusus lokal: ubah status order untuk mengetes tab di halaman Pesanan
  // (pending -> proses -> sent -> complete, atau expired). Tidak ada di backend asli.
  // "proses" (= sudah dibayar) memesan kurir pilihan user di Biteship, seperti backend tim.
  // Tanpa BITESHIP_API_KEY, "sent" mengisi resi tiruan. Body: { status, trackingNumber?, courierName? }.
  ["POST", /^\/dev\/orders\/([\w-]+)\/status$/, async (req, res, m) => {
    const b = await readBody(req);
    if (!["pending", "proses", "sent", "complete", "expired"].includes(b.status)) throw new HttpError(400, "Status tidak dikenal");
    const [cur] = await q(`select data from orders where invoice = $1`, [m[1]]);
    if (!cur) throw new HttpError(404, "Order tidak ditemukan");

    const patch = { status: b.status };
    const o = cur.data;
    const delivery = o.shipping?.id !== PICKUP_ID;
    const paidOrLater = ["proses", "sent", "complete"].includes(b.status);
    if (delivery && paidOrLater && !o.biteshipTrackingID && !o.trackingNumber) {
      if (BITESHIP_KEY && !b.trackingNumber) {
        Object.assign(patch, await bookShipment(o));
      } else if (b.status !== "proses") {
        patch.courierName = b.courierName || "J&T Express";
        patch.trackingNumber = b.trackingNumber || `JT${Date.now().toString().slice(-10)}`;
        patch.trackingUrl = TRACKING_URL.replace("{resi}", encodeURIComponent(patch.trackingNumber));
      }
    }
    await q(`update orders set data = data || $1::jsonb where invoice = $2`, [patch, m[1]]);
    ok(res, { invoice: m[1], ...patch }, "Status order diubah");
  }],

  // --- poin
  ["GET", /^\/points\/balance$/, async (req, res) => {
    const user = await authUser(req);
    ok(res, { userID: user.id, activePoints: user.points, expiringSoonPoints: 0, pointToRupiah: POINT_TO_RUPIAH });
  }],
  // ponytail: poin lokal tidak kedaluwarsa; tambah tanggal kedaluwarsa per lot bila perlu diuji.
  ["GET", /^\/points\/expiring-soon$/, async (req, res) => {
    await authUser(req);
    ok(res, { totalExpiring: 0, lots: [] });
  }],
  ["GET", /^\/points\/history$/, async (req, res, m, url) => {
    const user = await authUser(req);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 10));
    const rows = await q(
      `select id, user_id as "userID", type, amount, balance_after as "balanceAfter", description,
              created_at as "createdAt", count(*) over ()::int as total
         from point_ledger where user_id = $1 order by created_at desc limit $2 offset $3`,
      [user.id, limit, (page - 1) * limit]
    );
    const total = rows[0]?.total ?? 0;
    ok(res, { data: rows.map(({ total: _, ...r }) => r), total, totalPages: Math.ceil(total / limit) });
  }],
  ["GET", /^\/points\/catalog$/, async (req, res) => {
    await authUser(req);
    ok(res, REDEEM_CATALOG);
  }],
  ["POST", /^\/points\/redeem$/, async (req, res) => {
    const user = await authUser(req);
    const { catalogID } = await readBody(req);
    const item = REDEEM_CATALOG.find((c) => c.id === catalogID);
    if (!item) throw new HttpError(404, "Katalog tidak ditemukan");
    const voucher = await tx(async (client) => {
      // Kunci baris user supaya dua penukaran bersamaan tidak memakai saldo yang sama.
      await client.query(`select id from users where id = $1 for update`, [user.id]);
      const balance = await pointBalance(client, user.id);
      if (balance < item.pointCost) throw new HttpError(400, "Poin tidak cukup");
      await client.query(
        `insert into point_ledger (user_id, type, amount, balance_after, description) values ($1, 'redeem', $2, $3, $4)`,
        [user.id, -item.pointCost, balance - item.pointCost, `Tukar ${item.name}`]
      );
      const { rows } = await client.query(
        `insert into user_vouchers (user_id, name, description, discount, min_transaction, end_date)
         values ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) returning *`,
        [user.id, item.name, `${item.name}, min. belanja Rp${item.minTransaction.toLocaleString("id-ID")}`,
          item.discountValue, item.minTransaction, item.validityDays]
      );
      return userVoucherView(rows[0]);
    });
    ok(res, voucher, "Poin berhasil ditukar");
  }],
  ["GET", /^\/vouchers\/me$/, async (req, res) => ok(res, await myVouchers((await authUser(req)).id))],

  // --- email
  ["PUT", /^\/users\/email$/, async (req, res) => {
    const user = await authUser(req);
    const email = String((await readBody(req)).email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Format email tidak valid");
    await q(`update users set email = $1, email_valid = false, email_token = null where id = $2`, [email, user.id]);
    ok(res, null, "Email berhasil diperbarui");
  }],
  ["POST", /^\/users\/send-email-validation$/, async (req, res) => {
    const user = await authUser(req);
    const email = String((await readBody(req)).email || user.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Format email tidak valid");
    const token = crypto.randomBytes(24).toString("hex");
    await q(`update users set email = $1, email_valid = false, email_token = $2 where id = $3`, [email, token, user.id]);
    // Email tidak dikirim di lokal: buka link ini untuk memvalidasi.
    console.log(`  link validasi email ${email}: ${FRONTEND_URL}/profil/validate-email?token=${token}`);
    ok(res, null, "Link validasi terkirim (lokal: lihat log server)");
  }],
  ["GET", /^\/users\/validate-email$/, async (req, res, m, url) => {
    const token = url.searchParams.get("token") || "";
    const [row] = token ? await q(
      `update users set email_valid = true, email_token = null where email_token = $1 returning id`, [token]) : [];
    if (!row) throw new HttpError(400, "Link validasi tidak valid atau sudah dipakai");
    ok(res, null, "Email berhasil divalidasi");
  }],
];

// Dokumentasi API (Scalar) di /docs, spesifikasinya di /openapi.yaml.
const DOCS_HTML = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Topsell Checkout API</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0"></script>
  <script>Scalar.createApiReference('#app', { url: '/openapi.yaml', theme: 'default', hideClientButton: false })</script>
</body>
</html>`;
const OPENAPI_FILE = new URL("./openapi.yaml", import.meta.url);

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && (url.pathname === "/docs" || url.pathname === "/docs/")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(DOCS_HTML);
  }
  if (req.method === "GET" && url.pathname === "/openapi.yaml") {
    res.writeHead(200, { "Content-Type": "application/yaml; charset=utf-8" });
    return res.end(fs.readFileSync(OPENAPI_FILE)); // dibaca tiap request: edit spec langsung terlihat
  }
  const path = url.pathname.replace(/^\/api\/v1/, "").replace(/\/+$/, "");
  const started = Date.now();
  try {
    const route = routes.find(([method, re]) => method === req.method && re.test(path));
    if (!route) throw new HttpError(404, `Endpoint lokal belum ada: ${req.method} ${url.pathname}`);
    await route[2](req, res, path.match(route[1]), url);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { status, message: err.message });
  } finally {
    console.log(`${req.method} ${url.pathname}${url.search} -> ${res.statusCode} (${Date.now() - started}ms)`);
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await dbReady;
  server.listen(PORT, () => console.log(
    `API lokal jalan di http://localhost:${PORT}/api/v1  (OTP: ${OTP_CODE}, cari alamat: ${BITESHIP_KEY ? "Biteship" : "data contoh — isi BITESHIP_API_KEY di .env"})`
  ));
}
