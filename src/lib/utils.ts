import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format number as currency
export function formatCurrency(value: number | undefined | null, decimals: number = 2): string {
  if (value == null || isNaN(value)) return '0.00';
  return value.toFixed(decimals);
}

// Format price change percentage
export function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

// Format large numbers with K, M, B suffixes
export function formatCompactNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(2)
}

// Debounce utility function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Format symbol display to ensure suffixes are lowercase
export function formatSymbolDisplay(symbol: string): string {
  if (!symbol) return '';
  // Match trailing suffixes m, r, e (case-insensitive) and ensure they are lowercase
  // This logic assumes the suffix is a single character at the end
  return symbol.replace(/([A-Z0-9]+)([MREmre])$/, (match, p1, p2) => {
    return `${p1}${p2.toLowerCase()}`;
  });
}
