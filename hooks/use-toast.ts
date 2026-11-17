"use client"

import * as React from "react"

/**
 * Compatibility layer: `toast({ title, description, variant })` and `useToast()`
 * keep working, but the notification is BoardUI's.
 *
 * BoardUI's toast pulls in the whole animation library, so it is loaded the
 * first time a toast is actually shown rather than on every page. The
 * <Toaster /> in the root layout (components/ui/toaster.tsx) mounts itself on
 * the same signal.
 */
type ToastInput = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  duration?: number
}

type BoardToast = typeof import("@/components/base/toast/toast")
let loader: Promise<BoardToast> | null = null
const load = () => (loader ??= import("@/components/base/toast/toast"))

export const TOAST_EVENT = "topsell-toast"

function toast({ title, description, variant = "default", duration }: ToastInput) {
  // Identical messages replace each other instead of stacking.
  const id = `${String(title)}|${String(description)}`
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TOAST_EVENT))
  load().then((m) =>
    m.toast(title ?? description ?? "", {
      id,
      description: title ? description : undefined,
      status: variant === "destructive" ? "error" : "neutral",
      duration,
    })
  )
  return {
    id,
    dismiss: () => load().then((m) => m.toast.dismiss(id)),
    update: (next: ToastInput) =>
      load().then((m) =>
        m.toast.update(id, {
          title: next.title,
          description: next.description,
          status: next.variant === "destructive" ? "error" : undefined,
        })
      ),
  }
}

function useToast() {
  return {
    toasts: [] as never[],
    toast,
    dismiss: (id?: string) => {
      load().then((m) => m.toast.dismiss(id))
    },
  }
}

export { useToast, toast }
