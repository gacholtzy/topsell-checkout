import * as React from "react"
import { InputBase } from "@/components/base/input/input"
import { cx } from "@/utils/cx"

/**
 * Compatibility layer over BoardUI's InputBase (filled field, ring on focus).
 * Works as a plain controlled/uncontrolled <input>, so react-hook-form's
 * `{...field}` and onChange(event) keep working. Fields are 44px tall on
 * phones, 36px from md.
 */
type InputProps = Omit<React.ComponentProps<"input">, "size" | "className"> & {
  className?: string
  fieldClassName?: string
  leadingAddon?: React.ReactNode
  trailingAddon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, fieldClassName, leadingAddon, trailingAddon, ...props }, ref) => {
    return (
      <InputBase
        ref={ref}
        fieldClassName={cx("min-h-11 items-center md:min-h-9", "has-[input[aria-invalid=true]]:ring-border-error-default", fieldClassName)}
        className={className}
        leadingAddon={leadingAddon}
        trailingAddon={trailingAddon}
        {...(props as object)}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
