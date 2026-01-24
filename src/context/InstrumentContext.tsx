
"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api'
import { useAccount } from './AccountContext'

export interface Instrument {
    id: string
    symbol: string
    name: string
    description: string
    category: string
    group: string
    bid?: string
    ask?: string
    change?: string
    favorite?: boolean
}

interface InstrumentContextType {
    instruments: Instrument[]
    isLoading: boolean
    error: string | null
    categories: string[]
    refreshInstruments: () => Promise<void>
    getInstrumentsByCategory: (category: string) => Instrument[]
    toggleFavorite: (instrumentId: string) => Promise<void>
    reorderInstruments: (newOrder: Instrument[]) => Promise<void>
}

const InstrumentContext = createContext<InstrumentContextType | undefined>(undefined)

export function InstrumentProvider({ children }: { children: React.ReactNode }) {
    const { currentAccount, currentAccountId } = useAccount()
    const [instruments, setInstruments] = useState<Instrument[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const accountGroup = currentAccount?.group

    const fetchInstruments = useCallback(async (groupName: string, accountId?: string) => {
        if (!groupName) {
            setInstruments([])
            return
        }

        const cacheKey = `zup-instruments-${groupName}-${accountId || 'global'}`
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
            try {
                const { data } = JSON.parse(cached)
                setInstruments(data)
            } catch (e) { }
        }

        setIsLoading(true)
        setError(null)

        try {
            const endpoint = `/api/instruments?group=${encodeURIComponent(groupName)}${accountId ? `&accountId=${accountId}` : ''}`
            const response = await apiClient.get<Instrument[]>(endpoint)
            if (response.success && response.data) {
                setInstruments(response.data)
                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: response.data }))
            } else {
                setError(response.message || 'Failed to fetch symbols')
            }
        } catch (err) {
            console.error('[InstrumentContext] Fetch Error:', err)
            setError('Connection error')
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        if (accountGroup) {
            fetchInstruments(accountGroup, currentAccountId || undefined)
        }
    }, [accountGroup, currentAccountId, fetchInstruments])

    const categories = useMemo(() => {
        const cats = new Set(['Favorites', 'All instruments'])
        instruments.forEach(item => {
            if (item.category) cats.add(item.category)
        })
        return Array.from(cats)
    }, [instruments])

    const toggleFavorite = async (instrumentId: string) => {
        // Optimistic update
        setInstruments(prev => prev.map(inst =>
            inst.id === instrumentId ? { ...inst, favorite: !inst.favorite } : inst
        ))

        try {
            await apiClient.post('/api/instruments/favorites/toggle', {
                instrumentId,
                mt5AccountId: currentAccountId
            })
        } catch (err) {
            console.error('[InstrumentContext] Toggle Favorite Error:', err)
            // Revert on error
            setInstruments(prev => prev.map(inst =>
                inst.id === instrumentId ? { ...inst, favorite: !inst.favorite } : inst
            ))
        }
    }

    const reorderInstruments = async (newOrder: Instrument[]) => {
        setInstruments(newOrder)

        try {
            const orders = newOrder.map((inst, idx) => ({
                instrumentId: inst.id,
                sortOrder: idx
            }))

            await apiClient.post('/api/instruments/reorder', {
                orders,
                mt5AccountId: currentAccountId
            })
        } catch (err) {
            console.error('[InstrumentContext] Reorder Error:', err)
        }
    }

    const refreshInstruments = async () => {
        if (accountGroup) {
            await fetchInstruments(accountGroup, currentAccountId || undefined)
        }
    }

    const getInstrumentsByCategory = (category: string) => {
        if (category === 'All instruments') return instruments
        if (category === 'Favorites') return instruments.filter(i => i.favorite)
        return instruments.filter(i => i.category === category)
    }

    return (
        <InstrumentContext.Provider
            value={{
                instruments,
                isLoading,
                error,
                categories,
                refreshInstruments,
                getInstrumentsByCategory,
                toggleFavorite,
                reorderInstruments
            }}
        >
            {children}
        </InstrumentContext.Provider>
    )
}

export function useInstruments() {
    const context = useContext(InstrumentContext)
    if (context === undefined) {
        throw new Error('useInstruments must be used within an InstrumentProvider')
    }
    return context
}
