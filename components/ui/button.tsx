import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold transition-[transform,filter,background-color,box-shadow] duration-150 ease-[cubic-bezier(.2,.7,.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-btn)] hover:-translate-y-px hover:brightness-[1.12]",
        accent:
          "bg-[var(--accent)] text-[var(--foreground)] hover:-translate-y-px hover:brightness-[1.05]",
        destructive:
          "bg-[var(--destructive)] text-white hover:-translate-y-px hover:brightness-[1.08]",
        outline:
          "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:-translate-y-px hover:bg-[var(--paper)]",
        secondary:
          "border border-[var(--border)] bg-[var(--paper)] text-[var(--foreground)] hover:bg-[var(--card-hover)]",
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--paper)]",
        link:
          "text-[var(--foreground)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[var(--radius-sm)] px-3 text-xs",
        lg: "h-11 rounded-[var(--radius)] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
