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
  killSwitchActive?: boolean
  killSwitchUntil?: string | null
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
  const metaApiTokensRef = React.useRef<Record<string, string>>({})

  // Update ref whenever state changes for instant access
  useEffect(() => {
    metaApiTokensRef.current = metaApiTokens
  }, [metaApiTokens])

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

      // Load cached tokens
      try {
        const cachedTokens = localStorage.getItem('metaApiTokens');
        if (cachedTokens) {
          setMetaApiTokens(JSON.parse(cachedTokens));
        }
      } catch (e) { }
    }
  }, [])

  // Save current account to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (currentAccountId) {
        localStorage.setItem('defaultMt5Account', currentAccountId)
        localStorage.setItem('accountId', currentAccountId)
      }

      // Persist tokens
      if (Object.keys(metaApiTokens).length > 0) {
        localStorage.setItem('metaApiTokens', JSON.stringify(metaApiTokens));
      }
    }
  }, [currentAccountId, metaApiTokens])

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.get('/api/accounts') as any

      if (response.success && response.data) {
        const accounts = (response.data as any).accounts || []
        const defaultId = (response.data as any).defaultAccountId || null

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

  // Pre-fetch MetaAPI token when account changes

  // Get MetaAPI access token for an account
  const getMetaApiToken = useCallback(async (accountId: string): Promise<string | null> => {
    // Check ref first for synchronous access (0ms delay)
    if (metaApiTokensRef.current[accountId]) {
      return metaApiTokensRef.current[accountId];
    }

    try {
      const response = await apiClient.post(`/api/accounts/${accountId}/metaapi-login`) as any;

      if (response.success && response.data?.accessToken) {
        const token = (response.data as any).accessToken;
        setMetaApiTokens(prev => ({ ...prev, [accountId]: token }));
        return token;
      }
    } catch (err) {
      console.error('[AccountContext] Token fetch failed:', err);
    }

    return null;
  }, [])


  // Proactive Token Warm-up & Background Refresh
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) return;

    const warmUp = () => {
      if (currentAccountId) {
        console.log('[AccountContext] Proactively warming up token for:', currentAccountId);
        getMetaApiToken(currentAccountId);
      }
    };

    warmUp();
    // Refresh tokens every 50 minutes (they last 60-day in storage but we keep server session alive)
    const interval = setInterval(warmUp, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentAccountId, isAuthenticated, isAuthLoading, getMetaApiToken]);

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
