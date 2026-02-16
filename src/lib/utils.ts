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

/**
 * Checks if the market is closed for a given instrument.
 * @param symbol The instrument symbol
 * @param category The instrument category
 * @param bid Current bid price
 * @param ask Current ask price
 * @returns true if market is closed, false otherwise
 */
export function checkIsMarketClosed(symbol: string, category: string, bid?: number | string, ask?: number | string): boolean {
  // 1. Streaming Override: If we have valid prices, the market is open
  const bidNum = typeof bid === 'string' ? parseFloat(bid) : bid;
  const askNum = typeof ask === 'string' ? parseFloat(ask) : ask;

  if (bidNum !== undefined && bidNum > 0 && askNum !== undefined && askNum > 0) {
    return false;
  }

  const now = new Date();
  const day = now.getUTCDay();
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const lowerCat = (category || '').toLowerCase();
  const s = symbol.toLowerCase();
  const isCrypto = lowerCat.includes('crypto') ||
    s.includes('btc') || s.includes('eth') ||
    s.includes('xrp') || s.includes('ltc') ||
    s.includes('sol');

  if (isCrypto) {
    // Crypto closed daily 3:30 AM - 4:30 AM IST = 22:00 - 23:00 UTC
    return minutes >= 22 * 60 && minutes < 23 * 60;
  }

  // Non-crypto: General Weekend Break (Fri 21:00 UTC - Sun 21:05 UTC)
  const isWeekend =
    (day === 5 && minutes >= 21 * 60) ||
    day === 6 ||
    (day === 0 && minutes < 21 * 60 + 5);

  if (isWeekend) return true;

  // DAILY BREAK for Indices and Forex (21:00 - 22:05 UTC)
  // Most indices and many forex pairs have a 1-hour maintenance break
  const isIndices = lowerCat.includes('index') || lowerCat.includes('indice') ||
    s.includes('us30') || s.includes('nas') || s.includes('spx') || s.includes('dax');

  if (isIndices || lowerCat.includes('forex') || lowerCat.includes('metal')) {
    // Daily maintenance window: 21:00 to 22:05 UTC (covers US close to next day open)
    const isDailyBreak = minutes >= 21 * 60 && minutes < 22 * 60 + 5;
    if (isDailyBreak) return true;
  }

  return false;
}
