import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import {
  Button as BoardButton,
  buttonStyles,
  type ButtonProps as BoardButtonProps,
} from "@/components/base/buttons/button"
import { cx } from "@/utils/cx"

/**
 * Compatibility layer: the pages keep calling `<Button variant size asChild>`,
 * and this renders the BoardUI button (components/base/buttons/button.tsx).
 *
 *   default / destructive / outline / secondary / ghost / link
 *     -> primary / danger / secondary / secondary / ghost / ghost (underlined)
 *   size default | sm | lg | icon -> medium | small | medium (tall) | icon-only
 *
 * Touch targets stay at 44px on phones: BoardUI's own medium size is 36px.
 */
type Variant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
type Size = "default" | "sm" | "lg" | "icon"

const VARIANT: Record<Variant, keyof typeof buttonStyles.variant> = {
  default: "primary",
  destructive: "danger",
  outline: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  link: "ghost",
}

function classesFor(variant: Variant, size: Size) {
  const boardSize = size === "sm" ? "small" : "medium"
  return cx(
    buttonStyles.base,
    buttonStyles.size[boardSize],
    buttonStyles.variant[VARIANT[variant]],
    size === "default" && "max-md:h-11 max-md:px-4",
    size === "lg" && "h-11 px-5 text-body-medium md:h-11",
    size === "sm" && "max-md:h-10",
    size === "icon" && "size-11 p-0 md:size-9",
    variant === "link" && "underline underline-offset-4",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 gap-2",
  )
}

export function buttonVariants({
  variant = "default",
  size = "default",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cx(classesFor(variant, size), className)
}

export interface ButtonProps extends Omit<BoardButtonProps, "variant" | "size" | "iconOnly"> {
  variant?: Variant
  size?: Size
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, type, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cx(classesFor(variant, size), "px-3", className)} {...(props as object)}>
          {children}
        </Slot>
      )
    }
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cx(classesFor(variant, size), "px-3", className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
// Re-export so new code can reach the real BoardUI button from the same place.
export { BoardButton }
