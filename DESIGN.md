# Topsell Checkout — Design

Mode: **Operate** (an app people use under time pressure, mostly on a phone). Everything is judged by one question: can the customer see what to do next without thinking?

## Principles

1. **One job per screen, one primary action.** The red button is the next step. Nothing else on the page is red except the active state of that step.
2. **Structure by proximity, not by boxes.** One bordered sheet per area. Inside it, sections are separated by hairlines. No cards inside cards, no icon tiles above headings, no decorative gradients, glass or glow.
3. **Say what is missing.** A disabled "Konfirmasi Pesanan" always shows why (`blockedReason` in `app/(page)/page.tsx`). Steps turn into a green check when complete.
4. **Phone first.** 44px touch targets, pickers open as bottom sheets, total + primary action live in a bottom bar, inputs are ≥16px so iOS does not zoom.
5. **Prices are data.** Tabular numerals everywhere money appears, right-aligned, one currency format.

## Tokens (`app/globals.css`, `tailwind.config.ts`)

| Token | Value | Use |
|---|---|---|
| `--background` | warm off-white `30 18% 97%` | page |
| `--card` | white | sheets, inputs |
| `--foreground` | `20 14% 10%` | text (16.4:1) |
| `--muted-foreground` | `20 6% 36%` | secondary text (6.3:1 on page) |
| `--primary` | brand red `356 78% 45%` | primary action, active selection (5.6:1 with white) |
| `--accent` | `356 60% 96%` | selected row background |
| `--success` / `--success-soft` | green `152 62% 26%` | done steps, savings, paid |
| `--warning` / `--warning-soft` | amber `32 90% 28%` | deadlines, pending |
| `--destructive` | `0 70% 42%` | errors, sold out |
| `--border` / `--input` | hairline / `24 6% 56%` | dividers / form fields (3.2:1 on white) |
| `--radius` | `0.5rem` | everything; no pills except status chips |

Type: **Plus Jakarta Sans** (self-hosted by `next/font`), weights 500/600/700/800. Scale 12 / 14 / 16 / 20 / 30. Headings use `text-wrap: balance`.

Elevation: none on content. Shadows only on things that float (bottom bar, sheets, dropdowns) and always with a vertical offset and soft blur.

Motion: sheets slide, spinners spin, nothing else. `prefers-reduced-motion` turns it all off.

## Layout

- Content width `max-w-6xl` (checkout, cart), `max-w-2xl` (result pages: payment, thank-you, tracking), `max-w-3xl` (orders).
- Checkout and cart: `minmax(0,1fr) | 380px` grid from `lg`. Summary is sticky. Below `lg` the summary flows after the steps and a fixed bottom bar carries total + button (stacks under 400px).
- Steps (`components/checkout/section.tsx`): 1 Barang, 2 Pengiriman (method → address row → courier), 3 Pembayaran. Voucher sits at the top of the summary.

## Components

- `components/ui/*` is shadcn, restyled: 44px controls (40px from `md`), 8px radius, visible focus ring, `Dialog` is a bottom sheet below `sm` and a centred dialog above.
- Choice rows (shipping method, courier) are real radio groups: whole row clickable, `role="radio"`, selected = primary border + accent fill.
- Pickers that open a sheet (address, payment, voucher) share one row pattern: value on the left, underlined "Pilih / Ganti" on the right.

## Don't

- Don't add a second accent colour or a gradient.
- Don't wrap a bordered sheet in another card.
- Don't use red for anything that is not the primary action, an active choice, or an error.
- Don't truncate prices, invoice numbers or courier names; let them wrap.
