"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 outline-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        // Primary - Flat purple
        default: "bg-primary text-[#ffffff] hover:bg-primary/90",
        
        // Glass - Subtle glassmorphic button
        glass: "glass-card hover:bg-white/5 text-white",
        
        // Outline - Minimal border
        outline: "border border-foreground/10 bg-transparent hover:bg-white/5 text-foreground",
        
        // Ghost - No background
        ghost: "bg-transparent hover:bg-white/5 text-white",
        
        // Success - For buy/profit actions
        success: "bg-success text-[#ffffff] hover:bg-success/90",
        
        // Danger - For sell/loss actions  
        danger: "bg-danger text-[#ffffff] hover:bg-danger/90",
        
        // Link - Simple text button
        link: "text-primary underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 py-2",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  if (asChild) {
    return (
      <Slot
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }

  const isFullWidth = className?.includes("w-full")
  
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={isFullWidth ? "block w-full" : "inline-block"}
    >
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    </motion.div>
  )
}

export { Button, buttonVariants }
