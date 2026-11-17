import * as React from "react"
import { Chip, type ChipColor } from "@/components/base/badges/chip"

/** Compatibility layer: shadcn Badge variants rendered as BoardUI Chips. */
type Variant = "default" | "secondary" | "destructive" | "outline"

const COLOR: Record<Variant, ChipColor> = {
  default: "rose",
  secondary: "neutral",
  destructive: "rose",
  outline: "gray",
}

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  variant?: Variant
}

function Badge({ variant = "default", ...props }: BadgeProps) {
  return <Chip variant="caption" color={COLOR[variant]} {...props} />
}

const badgeVariants = () => ""

export { Badge, badgeVariants }
