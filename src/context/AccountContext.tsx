"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api'
import { useAuth } from './AuthContext'
import { useMultiAccountBalancePolling } from '@/hooks/useAccountBalances'

export interface MT5Account {
  id: string
  accountId: string
  displayAccountId: string
  accountType: 'Live' | 'Demo'
  group: string
  linkedAt: string
}

interface AccountContextType {
  mt5Accounts: MT5Account[]
  currentAccountId: string | null
  setCurrentAccountId: (accountId: string | null) => void
  defaultAccountId: string | null
  isLoading: boolean
  error: string | null
  refreshAccounts: () => Promise<void>
  balances: Record<string, any>
  isBalanceLoading: Record<string, boolean>
  balanceErrors: Record<string, string | null>
  currentBalance: any | null
  currentAccount: MT5Account | null
  refreshBalance: (accountId: string) => void
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [mt5Accounts, setMt5Accounts] = useState<MT5Account[]>([])
  const [currentAccountId, setCurrentAccountIdState] = useState<string | null>(null)
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get account IDs for balance polling
  const accountIds = useMemo(() => mt5Accounts.map(account => account.accountId), [mt5Accounts])
  const {
    balances,
    isLoading: isBalanceLoading,
    errors: balanceErrors,
    refreshBalance
  } = useMultiAccountBalancePolling(accountIds)

  // Current balance data for easy access
  const currentBalance = useMemo(() => (currentAccountId ? balances[currentAccountId] || null : null), [currentAccountId, balances])
  const currentAccount = useMemo(() => (currentAccountId ? mt5Accounts.find(acc => acc.accountId === currentAccountId) || null : null), [currentAccountId, mt5Accounts])

  // Load current account from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAccountId = localStorage.getItem('defaultMt5Account') || localStorage.getItem('accountId')
      if (savedAccountId) {
        setCurrentAccountIdState(savedAccountId)
      }
    }
  }, [])

  // Save current account to localStorage when it changes
  useEffect(() => {
    if (currentAccountId && typeof window !== 'undefined') {
      localStorage.setItem('defaultMt5Account', currentAccountId)
      localStorage.setItem('accountId', currentAccountId)
    }
  }, [currentAccountId])

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.get('/api/accounts')

      if (response.success && response.data) {
        const accounts = response.data.accounts || []
        const defaultId = response.data.defaultAccountId || null

        setMt5Accounts(accounts)
        setDefaultAccountId(defaultId)

        // Set current account if not already set
        if (!currentAccountId) {
          const savedAccountId = typeof window !== 'undefined'
            ? (localStorage.getItem('defaultMt5Account') || localStorage.getItem('accountId'))
            : null

          if (savedAccountId && accounts.some(acc => acc.accountId === savedAccountId)) {
            setCurrentAccountIdState(savedAccountId)
          } else if (defaultId) {
            setCurrentAccountIdState(defaultId)
          } else if (accounts.length > 0) {
            setCurrentAccountIdState(accounts[0].accountId)
          }
        }
      } else {
        setError(response.message || 'Failed to fetch accounts')
        setMt5Accounts([])
      }
    } catch (err) {
      console.error('[AccountContext] Error fetching accounts:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts')
      setMt5Accounts([])
    } finally {
      setIsLoading(false)
    }
  }, [currentAccountId])

  // Fetch accounts when authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      fetchAccounts()
    } else if (!isAuthLoading && !isAuthenticated) {
      // User not authenticated, clear accounts
      setMt5Accounts([])
      setIsLoading(false)
    }
  }, [fetchAccounts, isAuthenticated, isAuthLoading])

  const setCurrentAccountId = useCallback((accountId: string | null) => {
    setCurrentAccountIdState(accountId)
    if (accountId && typeof window !== 'undefined') {
      localStorage.setItem('defaultMt5Account', accountId)
      localStorage.setItem('accountId', accountId)
    }
  }, [])

  const refreshAccounts = useCallback(async () => {
    await fetchAccounts()
  }, [fetchAccounts])

  return (
    <AccountContext.Provider
      value={{
        mt5Accounts,
        currentAccountId,
        setCurrentAccountId,
        defaultAccountId,
        isLoading,
        error,
        refreshAccounts,
        balances,
        isBalanceLoading,
        balanceErrors,
        currentBalance,
        currentAccount,
        refreshBalance,
      }}
    >
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}
