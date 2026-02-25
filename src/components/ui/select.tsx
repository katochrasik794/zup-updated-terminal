"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode
}

function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-foreground/10 bg-white/[0.02] px-3 py-1 text-sm text-foreground",
        "focus:outline-none focus:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-foreground/10 bg-white/[0.02] px-3 py-1 text-sm text-foreground",
        "focus:outline-none focus:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <svg
        className="h-4 w-4 opacity-50"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

function SelectContent({ children, className }: SelectContentProps) {
  return (
    <div className={cn("absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-foreground/10 bg-gray-900 shadow-lg", className)}>
      {children}
    </div>
  )
}

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  children: React.ReactNode
  value: string
}

function SelectItem({ children, value, ...props }: SelectItemProps) {
  return (
    <option value={value} {...props}>
      {children}
    </option>
  )
}

interface SelectValueProps {
  placeholder?: string
  children?: React.ReactNode
}

function SelectValue({ placeholder, children }: SelectValueProps) {
  return <span>{children || placeholder}</span>
}

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
