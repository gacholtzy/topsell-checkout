export type AppSettings = { id: string; banner_imager: string[]; meta_your_pixel: string; body_script: string }
// Server: API_INTERNAL_URL. Browser (banner halaman login): NEXT_PUBLIC_API_URL.
// Default API lokal, bukan produksi.
const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || process.env.API_URL_LIVE || "http://localhost:8080"

export async function getAppSettings() {
  try {
    const res = await fetch(`${API}/api/v1/app-settings`, {
      // Root layout memanggil ini di setiap request halaman. Tanpa cache, tiap
      // halaman menunggu API dulu sebelum HTML terkirim. Pixel/banner jarang
      // berubah: perubahan di admin tampil paling lambat 5 menit kemudian.
      next: { revalidate: 300 },
      // Di server: API lambat/hang tidak boleh menahan semua halaman. Di browser
      // (banner halaman login) tidak dibatasi, supaya banner tetap muncul di sinyal lambat.
      signal: typeof window === 'undefined' ? AbortSignal.timeout(3000) : undefined,
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data as AppSettings | null
  } catch (err) {
    // swallow connection errors and return null so layout still renders
    return null
  }
}
