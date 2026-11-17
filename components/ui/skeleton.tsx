import { cx } from "@/utils/cx"

/** Loading placeholder in BoardUI's neutral surface tone. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("animate-pulse rounded-lg bg-background-tertiary-default", className)} {...props} />
}

export { Skeleton }
