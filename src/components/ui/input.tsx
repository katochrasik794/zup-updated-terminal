"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-white/8 bg-white/3 px-4 py-2 text-sm text-white",
        "backdrop-blur-sm transition-all duration-200",
        "placeholder:text-white/40",
        "focus:outline-none focus:border-white/12 focus:bg-white/5",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white",
        className
      )}
      {...props}
    />
  )
}

export { Input }
