// Self-check alur tahap 1 terhadap server lokal (butuh internet untuk data produk Woo
// dan database di DATABASE_URL). User tes memakai nomor acak dan dihapus lagi di akhir.
// Jalankan: node selfcheck.mjs
import assert from "node:assert/strict";

const { server, pool, dbReady, OTP_CODE } = await import("./server.mjs");
await dbReady;
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/api/v1`;

let token = "";
const call = async (method, p, body) => {
  const res = await fetch(base + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { http: res.status, ...(await res.json()) };
};

const local = String(Date.now()).slice(-9);
const phone = `0899${local}`;
try {
  assert.equal((await call("GET", "/carts")).http, 401, "tanpa token harus 401");
  assert.equal((await call("POST", "/users/login", { phoneNumber: phone })).http, 404, "belum daftar");
  assert.equal((await call("POST", "/users/register", { fullName: "Tes", email: "t@x.id", phoneNumber: phone })).status, 200);
  assert.equal((await call("POST", "/users/verify-otp", { phoneNumber: phone, otp: "000000" })).http, 400, "OTP salah");
  assert.equal((await call("POST", "/users/register", { fullName: "Tes", phoneNumber: phone })).http, 409, "nomor dobel");
  const login = await call("POST", "/users/verify-otp", { phoneNumber: `62899${local}`, otp: OTP_CODE });
  token = login.data.token;
  assert.ok(token && login.data.user.fullName === "Tes");

  // produk asli dari Woo; Kulkas Sharp (simple) dua kali -> qty bertambah, satu baris
  await call("POST", "/carts/items", { productId: 271593, variationId: "", qty: 1 });
  const add = await call("POST", "/carts/items", { productId: "271593", qty: 1 });
  assert.equal(add.data.qty, 2);
  const cart = await call("GET", "/carts");
  assert.equal(cart.data.items.length, 1);
  const item = cart.data.items[0];
  assert.ok(item.name && Number(item.price) > 0, "detail produk dari Woo terisi");

  const row = await call("GET", `/carts/items/${item.id}`);
  assert.equal(row.data.qty, 2);
  assert.equal(row.data.regularPrice, Number(item.price), "harga jual konsisten cart vs checkout");

  // stok: Sidoarjo cukup, Gresik habis
  const branches = await call("GET", `/carts/stock/branches?itemIds=${item.id}`);
  assert.equal(branches.data.length, 3);
  assert.equal(branches.data[2].availableItems, 0);
  const sda = await call("GET", `/carts/stock?storeId=store-sda&itemIds=${item.id}&qtys=2`);
  assert.equal(sda.data.canCheckout, item.stock > 0);

  // area & ongkir
  assert.equal((await call("GET", "/topsell-area-postal/check-postal-code-is-exist/61219")).data, true);
  // Ongkir luar area: Biteship bila ada key, Rp20.000 bila tidak. Dibaca dulu, dipakai di hitungan bawah.
  const price = async (postal, quantity) => (await call("POST", `/shippings/price?destination=x&postal_code=${postal}`,
    { product_ids_and_quantities: [{ id: "271593", quantity, variationId: "" }] })).data;
  assert.equal(await price("61219", 2), 0, "area Topsell gratis");
  const ongkir1 = await price("60281", 1);
  const ongkir2 = await price("60281", 2);
  assert.ok(ongkir1 > 0 && ongkir2 > 0, "luar area berbayar");
  assert.ok((await call("GET", "/address/search?search=sidoarjo&limit=5")).data.length > 0);

  // voucher: diskon 10% maks 50rb; voucher pickup tidak eligible untuk pengiriman
  const subtotal = row.data.regularPrice * 2;
  const vbody = { data: [{ id: item.id }], shippingID: "1", postalCode: "60281" };
  const v10 = await call("POST", "/vouchers/validate?voucherID=v-hemat10", vbody);
  assert.equal(v10.data, Math.min(Math.round(subtotal * 0.1), 50000));
  const list = await call("POST", "/vouchers/all", { data: [{ cartID: item.id }], shippingID: "1" });
  assert.equal(list.data.find((v) => v.id === "v-pickup25").isEligible, false);
  const ship = await call("POST", "/vouchers/validate?voucherID=v-ongkir", vbody);
  assert.equal(ship.data, Math.min(20000, ongkir2));

  // checkout 1 dari 2 unit, transfer manual, luar area
  // pilihan kurir (kontrak tim): luar area bayar penuh, area Topsell disubsidi jadi 0
  const optsBody = { product_ids_and_quantities: [{ id: "271593", quantity: 2, variationId: "" }] };
  const outOpts = (await call("POST", "/shippings/options?destination=x&postal_code=60281", optsBody)).data;
  assert.ok(outOpts.length >= 1 && outOpts.every((o) => o.price === o.listPrice && !o.freeArea));
  assert.equal(outOpts[0].price, ongkir2, "termurah dulu, sama dengan ongkir default");
  const inOpts = (await call("POST", "/shippings/options?destination=x&postal_code=61219", optsBody)).data;
  assert.ok(inOpts.every((o) => o.price === 0 && o.freeArea && o.listPrice > 0));
  // voucher ongkir mengikuti kurir yang DIPILIH, bukan yang termurah
  const priciest = outOpts[outOpts.length - 1];
  const shipPick = await call("POST", "/vouchers/validate?voucherID=v-ongkir",
    { ...vbody, courierCode: priciest.courierCode, courierServiceCode: priciest.courierServiceCode });
  assert.equal(shipPick.data, Math.min(20000, priciest.price));
  assert.equal((await call("POST", "/vouchers/validate?voucherID=v-ongkir",
    { ...vbody, courierCode: "tidakada", courierServiceCode: "x" })).http, 400, "kurir tidak tersedia");

  // pemilih alamat dua langkah: kecamatan dulu, lalu kode posnya
  const districts = (await call("GET", "/address/search?mode=local&search=sidoarjo&limit=300")).data;
  assert.ok(districts.length > 0 && districts.every((d) => d.zip_code === ""));
  const postals = (await call("GET", `/address/postal-codes?area_id=${encodeURIComponent(districts[0].id)}`)).data;
  assert.ok(postals.length > 0 && postals.every((p) => p.zip_code && p.id.startsWith(districts[0].id)));
  const byName = await call("GET", `/address/postal-codes?district=${encodeURIComponent(districts[0].district_name)}&city=${encodeURIComponent(districts[0].city_name)}`);
  assert.equal(byName.http, 200);

  const co = await call("POST", "/checkout", {
    address: "Jl. Tes 1", city: "Surabaya", postalCode: "60281", name: "Tes", email: "t@x.id", phone,
    cartItems: [{ id: item.id, qty: 1 }], shippingID: "1", paymentMethodID: "pm-manual",
    voucherID: "v-hemat10", shippingVoucherID: "v-ongkir",
  });
  assert.equal(co.http, 200);
  assert.match(co.redirectURL, /^\/manual\?inv=INV-LOCAL-/);
  const unit = row.data.regularPrice;
  assert.equal(co.data.ongkir, ongkir1);
  assert.equal(co.data.total, unit + ongkir1 - Math.min(Math.round(unit * 0.1), 50000) - Math.min(20000, ongkir1));
  assert.equal((await call("GET", "/carts")).data.items[0].qty, 1, "sisa 1 unit di keranjang");

  const order = await call("GET", `/orders?invoice=${co.data.invoice}`);
  assert.equal(order.data.paymentMethod.key, "manual");
  assert.equal(order.data.shipping.title, "Pengiriman Reguler");

  // pickup wajib pilih toko
  assert.equal((await call("POST", "/checkout", { cartItems: [{ id: item.id }], shippingID: "3", paymentMethodID: "pm-cc" })).http, 400);

  // keranjang & order tersimpan di database
  const { rows } = await pool.query(
    `select (select count(*) from orders o where o.user_id = u.id)::int as orders,
            (select qty from cart_items c where c.user_id = u.id) as qty
       from users u where u.phone_number = $1`, [`62899${local}`]);
  assert.deepEqual(rows[0], { orders: 1, qty: 1 });

  // ===== tahap 2 =====
  // riwayat order: order tadi ada di tab pending dengan sisa waktu bayar
  const pending = await call("GET", "/orders/history?page=1&limit=5&status=pending");
  assert.equal(pending.total, 1);
  assert.equal(pending.data[0].invoice, co.data.invoice);
  assert.ok(pending.data[0].paymentSecondsLeft > 23 * 3600);
  await call("POST", `/dev/orders/${co.data.invoice}/status`, { status: "proses" });
  assert.equal((await call("GET", "/orders/history?status=pending")).total, 0);
  assert.equal((await call("GET", "/orders/history?status=proses")).data[0].status, "proses");
  // dikirim: kurir dipesan di Biteship saat dibayar (proses), halaman tracking tim memakai kontraknya
  await call("POST", `/dev/orders/${co.data.invoice}/status`, { status: "sent" });
  const sent = (await call("GET", "/orders/history?status=sent")).data[0];
  if (process.env.BITESHIP_API_KEY) {
    assert.ok(sent.biteshipTrackingID && sent.trackingNumber, "resi & tracking id dari Biteship");
    assert.equal(sent.trackingUrl, `/tracking/${co.data.invoice}`);
    assert.ok(sent.biteshipStatusLabel && sent.courierServiceName);
    const track = await call("GET", `/orders/tracking?invoice=${co.data.invoice}`);
    assert.equal(track.http, 200);
    assert.equal(track.data.waybillId, sent.trackingNumber);
    assert.equal(track.data.orderStatus, "sent");
    assert.ok(track.data.history.length >= 1 && track.data.history[0].label && track.data.history[0].note);
  } else {
    assert.match(sent.trackingNumber, /^JT\d{10}$/);
    assert.ok(sent.trackingUrl.includes(sent.trackingNumber));
    assert.equal((await call("GET", `/orders/tracking?invoice=${co.data.invoice}`)).http, 404);
  }

  // poin: bonus member baru 20.000 -> tukar 10rb -> sisa 10.000; tukar 25rb ditolak
  assert.equal((await call("GET", "/points/balance")).data.activePoints, 20000);
  assert.equal((await call("POST", "/points/redeem", { catalogID: "cat-10k" })).http, 200);
  assert.equal((await call("GET", "/points/balance")).data.activePoints, 10000);
  assert.equal((await call("POST", "/points/redeem", { catalogID: "cat-25k" })).http, 400, "poin kurang");
  const hist = await call("GET", "/points/history?page=1&limit=10");
  assert.deepEqual(hist.data.data.map((h) => h.amount), [-10000, 20000]);
  assert.equal(hist.data.data[0].balanceAfter, 10000);

  // voucher hasil tukar poin: muncul di Voucher Saya & daftar checkout, sekali pakai
  const mine = (await call("GET", "/vouchers/me")).data;
  assert.equal(mine.length, 1);
  const uv = mine[0];
  assert.ok((await call("POST", "/vouchers/all", { data: [{ cartID: item.id }], shippingID: "3" })).data.some((v) => v.id === uv.id));
  assert.equal((await call("POST", `/vouchers/validate?voucherID=${uv.id}`, { data: [{ id: item.id }], shippingID: "3" })).data, 10000);

  // checkout QRIS + ambil di toko memakai voucher itu -> diarahkan ke halaman QR
  const co2 = await call("POST", "/checkout", {
    address: "-", city: "Sidoarjo", postalCode: "61219", name: "Tes", email: "t@x.id", phone,
    cartItems: [{ id: item.id }], shippingID: "3", areaID: "store-sda", paymentMethodID: "pm-qris", voucherID: uv.id,
  });
  assert.equal(co2.http, 200);
  assert.match(co2.redirectURL, /^\/qr-payment\?inv=/);
  assert.equal(co2.data.voucherDiscount, 10000);
  assert.equal((await call("GET", "/vouchers/me")).data.length, 0, "voucher terpakai");
  const qr = await call("GET", `/orders/qr-code?invoice=${co2.data.invoice}`);
  assert.equal(qr.data.amount, co2.data.total);
  assert.ok(qr.data.qrString.includes(co2.data.invoice));
  const pendingQris = await call("GET", "/orders/history?status=pending");
  assert.match(pendingQris.data[0].paymentUrl, /^\/qr-payment\?inv=/);

  // email: format salah ditolak; link validasi sekali pakai
  assert.equal((await call("PUT", "/users/email", { email: "bukan-email" })).http, 400);
  assert.equal((await call("POST", "/users/send-email-validation", { email: "baru@x.id" })).http, 200);
  assert.equal((await call("GET", "/users/me")).data.isEmailValid, false);
  const { rows: [{ email_token }] } = await pool.query(`select email_token from users where phone_number = $1`, [`62899${local}`]);
  assert.equal((await call("GET", `/users/validate-email?token=${email_token}`)).http, 200);
  const me = (await call("GET", "/users/me")).data;
  assert.equal(me.isEmailValid, true);
  assert.equal(me.email, "baru@x.id");
  assert.equal((await call("GET", `/users/validate-email?token=${email_token}`)).http, 400, "link sekali pakai");

  console.log("selfcheck OK");
} finally {
  // hapus user tes; sesi, keranjang, dan order ikut terhapus (on delete cascade)
  await pool.query(`delete from users where phone_number = $1`, [`62899${local}`]);
  server.close();
  await pool.end();
}
