import * as React from "react"
import { apiClient } from "@/lib/api"
import { useMT5WebSocket, AccountUpdate } from "./useMT5WebSocket"

export interface BalanceData {
  balance: number
  equity: number
  margin: number
  freeMargin: number
  marginLevel: number
  profit: number
  leverage: string
  totalPL: number
  credit: number
  accountType: "Demo" | "Live"
  name: string
  accountGroup: string
  groupName: string
}

export const initialBalanceData: BalanceData = {
  balance: 0,
  equity: 0,
  margin: 0,
  freeMargin: 0,
  marginLevel: 0,
  profit: 0,
  leverage: "1:200",
  totalPL: 0,
  credit: 0,
  accountType: "Live",
  name: "",
  accountGroup: "standard",
  groupName: "",
}

const BALANCE_CACHE_TTL_MS = 30 * 1000 // 30 seconds

const balanceCacheKey = (accountId: string) => `zuperior-balance-cache:${accountId}`

const loadBalanceCache = (accountId: string): BalanceData | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(balanceCacheKey(accountId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.ts && Date.now() - parsed.ts > BALANCE_CACHE_TTL_MS) return null
    if (parsed?.data) return parsed.data as BalanceData
  } catch { }
  return null
}

const saveBalanceCache = (accountId: string, data: BalanceData) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(balanceCacheKey(accountId), JSON.stringify({ ts: Date.now(), data }))
  } catch { }
}

export function useMultiAccountBalancePolling(accountIds: string[]) {
  const [balances, setBalances] = React.useState<Record<string, BalanceData>>({})
  const [isLoading, setIsLoading] = React.useState<Record<string, boolean>>({})
  const [errors, setErrors] = React.useState<Record<string, string | null>>({})
  const accountIdsRef = React.useRef<string[]>([])
  const requestControllers = React.useRef<Map<string, AbortController>>(new Map())
  const requestSeq = React.useRef<Map<string, number>>(new Map())

  // Handle WebSocket updates
  const handleAccountUpdate = React.useCallback((update: AccountUpdate) => {
    // console.log('[useAccountBalances] Update received:', update)
    setBalances(prev => {
      const current = prev[update.accountId]
      if (!current) return prev // Don't update if account not initialized yet (waiting for static data)

      const newProfit = Number((update.equity - (update.balance + current.credit)).toFixed(2));
      const newTotalPL = Number((update.equity - update.balance).toFixed(2));

      // Debug log if values seem off
      if (update.marginLevel > 0 && update.freeMargin === 0) {
        console.warn('[useAccountBalances] Suspicious data:', {
          accountId: update.accountId,
          marginLevel: update.marginLevel,
          freeMargin: update.freeMargin,
          equity: update.equity,
          balance: update.balance,
          calcPL: newTotalPL
        });
      }

      return {
        ...prev,
        [update.accountId]: {
          ...current,
          balance: update.balance,
          equity: update.equity,
          margin: update.marginUsed,
          freeMargin: update.freeMargin,
          marginLevel: update.marginLevel,
          // profit is not directly in update usually, but let's check if we can calculate it
          // Profit = Equity - Balance - Credit (roughly)
          // precise profit calculation might depend on broker, but usually:
          // Equity = Balance + Credit + FloatingPL
          // So FloatingPL = Equity - (Balance + Credit)
          profit: Number((update.equity - (update.balance + current.credit)).toFixed(2)),
          totalPL: Number((update.equity - update.balance).toFixed(2)), // simple total PL
        }
      }
    })
  }, [])

  // Enable WebSocket for these accounts
  useMT5WebSocket({
    accountIds,
    onAccountUpdate: handleAccountUpdate
  })

  // Initialize state for all accounts - only when accountIds change
  React.useEffect(() => {
    const prevIds = accountIdsRef.current
    const newIds = accountIds || []
    accountIdsRef.current = newIds

    // Remove state for accounts that are no longer in the list
    const removedIds = prevIds.filter(id => !newIds.includes(id))
    removedIds.forEach(id => {
      requestControllers.current.get(id)?.abort()
      requestControllers.current.delete(id)
      requestSeq.current.delete(id)
      setBalances(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setIsLoading(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setErrors(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    })

    // Initialize state for new accounts
    newIds.forEach(accountId => {
      if (!prevIds.includes(accountId)) {
        // Try to load from cache first
        const cached = loadBalanceCache(accountId)
        if (cached) {
          setBalances(prev => ({ ...prev, [accountId]: cached }))
        }
        setIsLoading(prev => ({ ...prev, [accountId]: true }))
        setErrors(prev => ({ ...prev, [accountId]: null }))
      }
    })
  }, [accountIds])

  // Fetch balance for a specific account using getClientProfile API (NOT getBalance)
  // This endpoint provides comprehensive account data including Balance, Equity, Margin, etc.
  const fetchAccountBalance = React.useCallback(async (accountId: string, _isInitial = false) => {
    if (!accountId) return

    const currentSeq = (requestSeq.current.get(accountId) || 0) + 1
    requestSeq.current.set(accountId, currentSeq)

    try {
      const response = await apiClient.get<any>(`/api/accounts/${accountId}/profile`)

      if ((requestSeq.current.get(accountId) || 0) !== currentSeq) return

      if (response.success && response.data) {
        const d = response.data
        const formatted: BalanceData = {
          balance: Number(d.Balance ?? 0),
          equity: Number(d.Equity ?? 0),
          margin: Number(d.Margin ?? 0),
          freeMargin: Number(d.MarginFree ?? 0),
          marginLevel: Number(d.MarginLevel ?? 0),
          profit: Number(d.Profit ?? 0),
          leverage: (d.Leverage || d.MarginLeverage) ? (String(d.Leverage || d.MarginLeverage).startsWith('1:') ? (d.Leverage || d.MarginLeverage) : `1:${d.Leverage || d.MarginLeverage}`) : '1:200',
          totalPL: Number(((d.Equity ?? 0) - (d.Balance ?? 0)).toFixed(2)),
          credit: Number(d.Credit ?? 0),
          accountType: 'Live',
          name: d.Name || '',
          accountGroup: d.Group || 'standard',
          groupName: '',
        }

        setBalances(prev => ({ ...prev, [accountId]: formatted }))
        setErrors(prev => ({ ...prev, [accountId]: null }))
        saveBalanceCache(accountId, formatted)
      } else {
        throw new Error(response.message || 'API Error')
      }
    } catch (e: any) {
      // Handle 401 Unauthorized gracefully - don't set error for auth issues
      if (e.status === 401) {
        // Silently handle 401 - user may not be authenticated yet
        setErrors(prev => ({ ...prev, [accountId]: null }))
        // Don't clear balance data on 401 - keep cached data if available
        return
      }

      // For other errors, set error message but don't clear balance (keep cached)
      setErrors(prev => ({ ...prev, [accountId]: e.message || 'Failed to fetch balance' }))
    } finally {
      setIsLoading(prev => ({ ...prev, [accountId]: false }))
    }
  }, [])

  // Set up polling for all accounts
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null)
  const pendingRequestsRef = React.useRef<Set<string>>(new Set())

  const throttledFetchAccountBalance = React.useCallback(
    async (accountId: string, isInitial: boolean) => {
      if (pendingRequestsRef.current.has(accountId)) {
        return
      }

      pendingRequestsRef.current.add(accountId)
      if (isInitial) setIsLoading(prev => ({ ...prev, [accountId]: true }))

      try {
        await fetchAccountBalance(accountId, isInitial)
      } finally {
        pendingRequestsRef.current.delete(accountId)
      }
    },
    [fetchAccountBalance]
  )

  // Initial fetch for all accounts (static data + initial balance)
  React.useEffect(() => {
    if (accountIdsRef.current.length === 0) return

    accountIdsRef.current.forEach(accountId => {
      // Always fetch initially to get static data (name, leverage, etc) which is not in WS
      throttledFetchAccountBalance(accountId, true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds]) // Only run when accountIds list changes

  // Removed polling interval - relying on WebSocket updates now for real-time data

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      requestControllers.current.forEach(controller => controller.abort())
      requestControllers.current.clear()
    }
  }, [])

  const refreshBalance = React.useCallback((accountId: string) => {
    if (accountIdsRef.current.includes(accountId)) {
      throttledFetchAccountBalance(accountId, false)
    }
  }, [throttledFetchAccountBalance])

  return {
    balances,
    isLoading,
    errors,
    refreshBalance,
  }
}
