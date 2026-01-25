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
  isAccountSwitching: boolean
  error: string | null
  refreshAccounts: () => Promise<void>
  balances: Record<string, any>
  isBalanceLoading: Record<string, boolean>
  balanceErrors: Record<string, string | null>
  currentBalance: any | null
  currentAccount: MT5Account | null
  refreshBalance: (accountId: string) => void
  metaApiTokens: Record<string, string> // accountId -> accessToken
  getMetaApiToken: (accountId: string) => Promise<string | null>
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const [mt5Accounts, setMt5Accounts] = useState<MT5Account[]>([])
  const [currentAccountId, setCurrentAccountIdState] = useState<string | null>(null)
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccountSwitching, setIsAccountSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metaApiTokens, setMetaApiTokens] = useState<Record<string, string>>({})

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

  // Load current account from localStorage or URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlAccountId = params.get('accountId');
      const savedAccountId = urlAccountId || localStorage.getItem('defaultMt5Account') || localStorage.getItem('accountId')

      if (savedAccountId && savedAccountId !== 'undefined' && savedAccountId !== 'null') {
        setCurrentAccountIdState(savedAccountId)
      } else {
        // Clear invalid IDs
        if (typeof window !== 'undefined') {
          localStorage.removeItem('defaultMt5Account');
          localStorage.removeItem('accountId');
        }
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

        // Set current account if not already set or invalid
        const savedAccountId = typeof window !== 'undefined'
          ? (localStorage.getItem('defaultMt5Account') || localStorage.getItem('accountId'))
          : null

        const isValidSavedId = savedAccountId &&
          savedAccountId !== 'undefined' &&
          savedAccountId !== 'null' &&
          accounts.some(acc => acc.accountId === savedAccountId);

        if (!currentAccountId || !accounts.some(acc => acc.accountId === currentAccountId)) {
          if (isValidSavedId) {
            setCurrentAccountIdState(savedAccountId)
          } else if (defaultId && accounts.some(acc => acc.accountId === defaultId)) {
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
      // User not authenticated, clear accounts and current selection
      setMt5Accounts([])
      setCurrentAccountIdState(null)
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

  // Get MetaAPI access token for an account
  const getMetaApiToken = useCallback(async (accountId: string): Promise<string | null> => {
    // Check cache first
    if (metaApiTokens[accountId]) {
      return metaApiTokens[accountId];
    }

    try {
      const response = await apiClient.post(`/api/accounts/${accountId}/metaapi-login`);

      if (response.success && response.data?.accessToken) {
        const token = response.data.accessToken;
        setMetaApiTokens(prev => ({ ...prev, [accountId]: token }));
        return token;
      }
    } catch (err) {
      console.error(`[AccountContext] Failed to get MetaAPI token for ${accountId}:`, err);
    }

    return null;
  }, [metaApiTokens])

  return (
    <AccountContext.Provider
      value={{
        mt5Accounts,
        currentAccountId,
        setCurrentAccountId,
        defaultAccountId,
        isLoading,
        isAccountSwitching,
        error,
        refreshAccounts,
        balances,
        isBalanceLoading,
        balanceErrors,
        currentBalance,
        currentAccount,
        refreshBalance,
        metaApiTokens,
        getMetaApiToken,
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
