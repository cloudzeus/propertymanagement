import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--paper)] text-[var(--foreground)]",
        accent:
          "border-transparent bg-[color-mix(in_oklab,var(--accent)_20%,var(--card))] text-[var(--foreground)]",
        success:
          "border-transparent bg-[color-mix(in_oklab,var(--color-success)_16%,var(--card))] text-[var(--color-success)]",
        warning:
          "border-transparent bg-[color-mix(in_oklab,var(--color-warning)_16%,var(--card))] text-[var(--color-warning)]",
        danger:
          "border-transparent bg-[color-mix(in_oklab,var(--destructive)_12%,var(--card))] text-[var(--destructive)]",
        kicker:
          "rounded-none border-none bg-transparent px-0 uppercase tracking-[0.14em] text-[var(--muted-foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Show an amber dot before the label (eyebrow style). */
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
          style={{ boxShadow: "0 0 10px rgba(242,162,60,.55)" }}
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
