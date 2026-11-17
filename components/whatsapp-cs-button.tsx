"use client"

export const CS_WHATSAPP_URL = "https://links.topsellbelanja.com/wa-cs-topsellbelanja"

/** Floating WhatsApp button to reach customer service, fixed to the bottom-right. */
const WhatsappCsButton = () => (
    <a
        href={CS_WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hubungi CS Topsell via WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition hover:scale-105 hover:bg-[#1ebe5b]"
    >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/whatsapp.svg" alt="" className="h-8 w-8" />
    </a>
)

export default WhatsappCsButton
