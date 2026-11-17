"use client"

import * as React from "react"
import { toast as boardToast } from "@/components/base/toast/toast"

/**
 * Compatibility layer: `toast({ title, description, variant })` and `useToast()`
 * keep working, but the notification is BoardUI's (mount <Toaster /> from
 * components/base/toast/toast once, in the root layout).
 */
type ToastInput = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive"
  duration?: number
}

function toast({ title, description, variant = "default", duration }: ToastInput) {
  const id = boardToast(title ?? description ?? "", {
    id: `${String(title)}|${String(description)}`,
    description: title ? description : undefined,
    status: variant === "destructive" ? "error" : "neutral",
    duration,
  })
  return {
    id: String(id),
    dismiss: () => boardToast.dismiss(id),
    update: (next: ToastInput) =>
      boardToast.update(id, {
        title: next.title,
        description: next.description,
        status: next.variant === "destructive" ? "error" : undefined,
      }),
  }
}

function useToast() {
  return {
    toasts: [] as never[],
    toast,
    dismiss: (id?: string) => boardToast.dismiss(id),
  }
}

export { useToast, toast }
