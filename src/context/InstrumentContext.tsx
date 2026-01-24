
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

    const getFavoritesKey = useCallback((accountId: string) => {
        return `zup-favorites-${accountId}`
    }, [])

    const fetchInstruments = useCallback(async (groupName: string, accountId?: string) => {
        if (!groupName) {
            setInstruments([])
            return
        }

        const cacheKey = `zup-instruments-${groupName}-${accountId || 'global'}`
        const cached = localStorage.getItem(cacheKey)

        let initialData: Instrument[] = []
        if (cached) {
            try {
                const { data } = JSON.parse(cached)
                initialData = data
            } catch (e) { }
        }

        // Apply local favorites override immediately if we have data
        if (initialData.length > 0 && accountId) {
            const favKey = getFavoritesKey(accountId)
            const rawFavs = localStorage.getItem(favKey)
            const favSet = rawFavs ? new Set(JSON.parse(rawFavs)) : new Set()

            initialData = initialData.map(inst => ({
                ...inst,
                favorite: favSet.has(inst.id)
            }))
        }

        // Initial render with cached data (and merged favorites)
        if (initialData.length > 0) {
            setInstruments(initialData)
        }

        setIsLoading(true)
        setError(null)

        try {
            const endpoint = `/api/instruments?group=${encodeURIComponent(groupName)}${accountId ? `&accountId=${accountId}` : ''}`
            const response = await apiClient.get<Instrument[]>(endpoint)

            if (response.success && response.data) {
                let freshData = response.data

                // Merge Client-Side Favorites
                if (accountId) {
                    const favKey = getFavoritesKey(accountId)
                    const rawFavs = localStorage.getItem(favKey)
                    const favSet = rawFavs ? new Set(JSON.parse(rawFavs)) : new Set()

                    freshData = freshData.map(inst => ({
                        ...inst,
                        favorite: favSet.has(inst.id)
                    }))
                }

                setInstruments(freshData)
                localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: freshData }))
            } else {
                setError(response.message || 'Failed to fetch symbols')
            }
        } catch (err) {
            console.error('[InstrumentContext] Fetch Error:', err)
            setError('Connection error')
        } finally {
            setIsLoading(false)
        }
    }, [getFavoritesKey])

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
        if (!currentAccountId) return

        const favKey = getFavoritesKey(currentAccountId)
        const rawFavs = localStorage.getItem(favKey)
        const favSet = rawFavs ? new Set<string>(JSON.parse(rawFavs)) : new Set<string>()

        // Toggle
        if (favSet.has(instrumentId)) {
            favSet.delete(instrumentId)
        } else {
            favSet.add(instrumentId)
        }

        // Save to Cache
        localStorage.setItem(favKey, JSON.stringify(Array.from(favSet)))

        // Update State
        setInstruments(prev => prev.map(inst =>
            inst.id === instrumentId ? { ...inst, favorite: favSet.has(instrumentId) } : inst
        ))
    }

    const reorderInstruments = async (newOrder: Instrument[]) => {
        setInstruments(newOrder)
        // Note: Reordering persistence removed as per user request to avoid DB usage.
        // If client-side reordering persistence is needed, we would implement `zup-order-<accountId>` here.
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
