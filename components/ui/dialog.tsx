"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Heading } from "react-aria-components"
import { Modal, useModalClose } from "@/components/base/modal/modal"
import { Drawer } from "@/components/base/drawer/drawer"
import { CloseButton } from "@/components/base/buttons/close-button"
import { cx } from "@/utils/cx"

/**
 * Compatibility layer: the Radix-style Dialog API (Dialog, DialogTrigger,
 * DialogContent, DialogHeader, DialogTitle, ...) rendered with BoardUI's
 * Modal on wide screens and its Drawer (a bottom sheet) on phones.
 */
const DialogCtx = React.createContext<{ open: boolean; setOpen: (o: boolean) => void } | null>(null)

function useDialogCtx() {
  const ctx = React.useContext(DialogCtx)
  if (!ctx) throw new Error("Dialog parts must be inside <Dialog>")
  return ctx
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(min-width: 640px)")
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
function useIsWide() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true
  )
}

function Dialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [inner, setInner] = React.useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : inner
  const setOpen = React.useCallback(
    (o: boolean) => {
      if (!controlled) setInner(o)
      onOpenChange?.(o)
    },
    [controlled, onOpenChange]
  )
  return <DialogCtx.Provider value={{ open, setOpen }}>{children}</DialogCtx.Provider>
}

const DialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, onClick, children, ...props }, ref) => {
  const { setOpen } = useDialogCtx()
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : "button"}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)
        if (!e.defaultPrevented) setOpen(true)
      }}
      {...props}
    >
      {children}
    </Comp>
  )
})
DialogTrigger.displayName = "DialogTrigger"

const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>
const DialogOverlay = () => null

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { "aria-label"?: string; hideClose?: boolean; dismissable?: boolean }
>(({ className, children, hideClose, dismissable = true, "aria-label": ariaLabel }, _ref) => {
  const { open, setOpen } = useDialogCtx()
  const wide = useIsWide()
  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {!hideClose && <ContentClose />}
      <div className={cx("grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-y-auto overscroll-contain px-5 sm:px-6", className)}>
        {children}
      </div>
    </div>
  )
  return wide ? (
    <Modal isOpen={open} onOpenChange={setOpen} size="md" aria-label={ariaLabel} isDismissable={dismissable} isKeyboardDismissDisabled={!dismissable}>
      {body}
    </Modal>
  ) : (
    <Drawer placement="bottom" isOpen={open} onOpenChange={setOpen} aria-label={ariaLabel} isDismissable={dismissable} isKeyboardDismissDisabled={!dismissable}>
      {body}
    </Drawer>
  )
})
DialogContent.displayName = "DialogContent"

function ContentClose() {
  const close = useModalClose()
  return (
    <CloseButton
      size="sm"
      aria-label="Tutup"
      onClick={close}
      className="absolute end-3 top-0 z-10 shrink-0"
    />
  )
}

function DialogClose({ children, asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { setOpen } = useDialogCtx()
  const Comp = asChild ? Slot : "button"
  return (
    <Comp type={asChild ? undefined : "button"} onClick={() => setOpen(false)} {...props}>
      {children}
    </Comp>
  )
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cx("flex flex-col gap-1 pe-10", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cx("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = ({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading slot="title" className={cx("text-title-3-medium text-text-primary", className)}>
    {children}
  </Heading>
)
DialogTitle.displayName = "DialogTitle"

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cx("text-body-regular text-text-secondary", className)} {...props} />
)
DialogDescription.displayName = "DialogDescription"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
