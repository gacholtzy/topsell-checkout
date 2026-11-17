"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { TOAST_EVENT } from "@/hooks/use-toast"

const BoardToaster = dynamic(
  () => import("@/components/base/toast/toast").then((m) => m.Toaster),
  { ssr: false }
)

/** Mounts BoardUI's Toaster the first time a toast is shown (see hooks/use-toast.ts). */
export function Toaster() {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const show = () => setOn(true)
    window.addEventListener(TOAST_EVENT, show)
    return () => window.removeEventListener(TOAST_EVENT, show)
  }, [])
  return on ? <BoardToaster /> : null
}
