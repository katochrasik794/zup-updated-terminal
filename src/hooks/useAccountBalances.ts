"use client"

import * as React from "react"

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
    // Validate accountId before making request
    if (!accountId || accountId.trim() === '') {
      console.warn('[useAccountBalances] Skipping fetch - invalid accountId:', accountId);
      return;
    }

    const API_PATH = `/apis/user/${accountId}/getClientProfile`
    const currentSeq = (requestSeq.current.get(accountId) || 0) + 1
    requestSeq.current.set(accountId, currentSeq)

    try {
      // Cancel any in-flight request for this account to favor the latest call
      const existing = requestControllers.current.get(accountId)
      existing?.abort()

      const controller = new AbortController()
      requestControllers.current.set(accountId, controller)
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      let response: Response | null = null
      try {
        console.log(`[useAccountBalances] Fetching from: ${API_PATH}`)
        response = await fetch(API_PATH, {
          cache: "no-store",
          signal: controller.signal,
          credentials: 'include', // Include cookies for session
        })
        clearTimeout(timeoutId)
        console.log(`[useAccountBalances] Response status for ${accountId}:`, response.status, response.statusText)
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        console.error(`[useAccountBalances] Fetch error for ${accountId}:`, fetchErr)
        if (fetchErr.name === "AbortError") {
          throw new Error("Request timeout - server took too long to respond")
        }
        throw fetchErr
      }

      if (!response) return

      if (!response.ok) {
        // Handle 404 specifically - might indicate route not found or invalid accountId
        if (response.status === 404) {
          console.warn(`[useAccountBalances] getClientProfile endpoint not found for accountId: ${accountId}. This might indicate the account doesn't exist or the route is misconfigured.`);
          return; // Silently skip - don't throw error for 404s
        }
        const result = await response.json().catch(() => ({ error: `HTTP status ${response.status}` }))
        throw new Error(result.error || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log(`[useAccountBalances] Response data for ${accountId}:`, result)

      // Ignore stale responses
      if ((requestSeq.current.get(accountId) || 0) !== currentSeq) {
        console.log(`[useAccountBalances] Ignoring stale response for ${accountId}`)
        return
      }

      const responseData = result.data || result.Data || result
      console.log(`[useAccountBalances] Processed responseData for ${accountId}:`, responseData)

      if (result.success && responseData) {
        const apiData = responseData as {
          Balance?: number
          balance?: number
          Equity?: number
          equity?: number
          Margin?: number
          MarginUsed?: number
          marginUsed?: number
          margin?: number
          FreeMargin?: number
          freeMargin?: number
          MarginLevel?: number
          marginLevel?: number
          profit?: number
          Profit?: number
          Leverage?: string
          leverage?: string
          Credit?: number
          credit?: number
          Name?: string
          name?: string
          Group?: string
          group?: string
          AccountType?: string
          accountType?: string
        }

        const balance = Number(apiData.Balance ?? apiData.balance ?? 0) || 0
        const equity = Number(apiData.Equity ?? apiData.equity ?? 0) || 0
        const margin = Number(apiData.Margin ?? apiData.MarginUsed ?? apiData.marginUsed ?? apiData.margin ?? 0) || 0
        const freeMargin = Number(apiData.FreeMargin ?? apiData.freeMargin ?? 0) || 0
        const credit = Number(apiData.Credit ?? apiData.credit ?? 0) || 0
        const totalPL = equity - balance
        const profit = Number(apiData.Profit ?? apiData.profit ?? totalPL) || totalPL

        const groupValue = apiData.Group ?? apiData.group ?? ""
        const accountGroup = groupValue ? groupValue.split("\\").pop()?.toLowerCase() || "standard" : "standard"
        const groupName = groupValue || "" // Full group name to match group_management.group
        const groupLower = groupValue.toLowerCase()
        let finalAccountType: "Demo" | "Live" = "Live"

        if (groupLower.includes("demo")) {
          finalAccountType = "Demo"
        } else if (groupLower.includes("live")) {
          finalAccountType = "Live"
        } else {
          const accountTypeFromField =
            apiData.AccountType === "Live" || apiData.accountType === "Live" ? "Live" : "Demo"
          finalAccountType = accountTypeFromField
        }

        const newBalanceData: BalanceData = {
          balance,
          equity,
          margin,
          freeMargin,
          marginLevel: apiData.MarginLevel ?? apiData.marginLevel ?? 0,
          profit,
          leverage: apiData.Leverage ?? apiData.leverage ?? "1:200",
          totalPL: parseFloat(totalPL.toFixed(2)),
          credit,
          name: apiData.Name ?? apiData.name ?? "Test",
          accountGroup,
          groupName, // Full group name for symbol access filtering
          accountType: finalAccountType,
        }

        console.log(`[useAccountBalances] Successfully processed balance data for ${accountId}:`, newBalanceData)
        saveBalanceCache(accountId, newBalanceData)
        setBalances(prev => {
          if (!accountIdsRef.current.includes(accountId)) {
            console.warn(`[useAccountBalances] Account ${accountId} not in current accountIds list, skipping update`)
            return prev
          }
          const updated = { ...prev, [accountId]: { ...newBalanceData } }
          console.log(`[useAccountBalances] Updated balances state for ${accountId}:`, updated)
          return updated
        })
        setErrors(prev => ({ ...prev, [accountId]: null }))
      } else {
        throw new Error(result.error || result.message || "Failed to load account data.")
      }
    } catch (e) {
      const errorMessage = `Failed to fetch balance for ${accountId}: ${e instanceof Error ? e.message : "Unknown error"}`
      setErrors(prev => ({ ...prev, [accountId]: errorMessage }))
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
      setIsLoading(prev => ({ ...prev, [accountId]: true }))

      try {
        await fetchAccountBalance(accountId, isInitial)
      } finally {
        pendingRequestsRef.current.delete(accountId)
      }
    },
    [fetchAccountBalance]
  )

  // Initial fetch for all accounts
  React.useEffect(() => {
    if (accountIdsRef.current.length === 0) {
      console.log('[useAccountBalances] No account IDs to fetch balances for')
      return
    }

    console.log('[useAccountBalances] Starting initial fetch for accounts:', accountIdsRef.current)
    accountIdsRef.current.forEach(accountId => {
      const cached = loadBalanceCache(accountId)
      if (cached) {
        console.log(`[useAccountBalances] Using cached balance for ${accountId}:`, cached)
        setBalances(prev => ({ ...prev, [accountId]: cached }))
      } else {
        console.log(`[useAccountBalances] No cache for ${accountId}, fetching from API`)
      }
      throttledFetchAccountBalance(accountId, true)
    })
  }, [throttledFetchAccountBalance])

  // Set up polling interval
  React.useEffect(() => {
    if (accountIdsRef.current.length === 0) return

    intervalRef.current = setInterval(() => {
      accountIdsRef.current.forEach(accountId => {
        throttledFetchAccountBalance(accountId, false)
      })
    }, 3000) // Poll every 3 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [throttledFetchAccountBalance])

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
