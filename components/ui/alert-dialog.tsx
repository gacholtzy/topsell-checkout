"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/** Compatibility layer: the Radix AlertDialog API on the same BoardUI-backed dialog. */
const AlertDialog = Dialog
const AlertDialogContent = DialogContent
const AlertDialogHeader = DialogHeader
const AlertDialogFooter = DialogFooter
const AlertDialogTitle = DialogTitle
const AlertDialogDescription = DialogDescription

const AlertDialogAction = ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <DialogClose asChild>
    <Button onClick={onClick} {...props}>{children}</Button>
  </DialogClose>
)
const AlertDialogCancel = ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <DialogClose asChild>
    <Button variant="outline" onClick={onClick} {...props}>{children}</Button>
  </DialogClose>
)

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
