import * as React from "react"
import { TextareaBase } from "@/components/base/textarea/textarea"

/** Compatibility layer over BoardUI's TextareaBase (plain <textarea> props, RHF friendly). */
type TextareaProps = Omit<React.ComponentProps<"textarea">, "className" | "rows"> & {
  className?: string
  rows?: number
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => (
    <TextareaBase ref={ref} rows={rows} className={className} {...(props as object)} />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
