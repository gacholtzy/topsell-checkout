export const priceToIDR = ( price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
}

export const dateStringToLocale = (date: string) => {
    // 2025-02-28T10:18:12+07:00 to 28 Februari 2025
    const d = new Date(date)
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
}