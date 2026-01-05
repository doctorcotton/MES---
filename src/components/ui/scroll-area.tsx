import * as React from "react"
import { cn } from "@/lib/utils"

// Simplified ScrollArea utilizing native scrolling to avoid adding new dependencies
const ScrollArea = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("relative overflow-auto", className)}
        {...props}
    >
        {children}
    </div>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
