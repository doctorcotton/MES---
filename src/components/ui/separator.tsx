import * as React from "react"
import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }
>(
    (
        { className, orientation = "horizontal", ...props },
        ref
    ) => (
        <div
            ref={ref}
            className={cn(
                "shrink-0 bg-border bg-gray-200", // Added bg-gray-200 as fallback
                orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
                className
            )}
            {...props}
        />
    )
)
Separator.displayName = "Separator"

export { Separator }
