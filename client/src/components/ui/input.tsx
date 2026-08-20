import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          // Focus shows as an on-brand border color, not an offset ring. The old
          // ring-2 + ring-offset-2 drew a second ring 2px outside the element, which
          // doubled up (and read blue) wherever a screen already draws its own focus
          // treatment. A bare input still gets a clear single focus cue; custom-styled
          // inputs own their focus and no longer stack a second ring.
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/60 placeholder:italic placeholder:text-xs focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
