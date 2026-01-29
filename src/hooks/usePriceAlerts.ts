import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

export interface PriceAlert {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  notificationSent: boolean;
}

export interface CreatePriceAlertInput {
  accountId: string;
  symbol: string;
  targetPrice: number;
  condition: 'above' | 'below';
}

export interface UpdatePriceAlertInput {
  targetPrice?: number;
  condition?: 'above' | 'below';
  isActive?: boolean;
}

export function usePriceAlerts(accountId?: string) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = accountId ? { accountId } : {};
      const response = await apiClient.get<PriceAlert[]>('/api/alerts', params);
      if (response.success && response.data) {
        setAlerts(response.data);
      } else {
        setError('Failed to fetch alerts');
      }
    } catch (err: any) {
      console.error('[usePriceAlerts] Error fetching alerts:', err);
      setError(err.message || 'Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  const createAlert = useCallback(async (input: CreatePriceAlertInput): Promise<PriceAlert | null> => {
    try {
      const response = await apiClient.post<PriceAlert>('/api/alerts', input);
      if (response.success && response.data) {
        setAlerts(prev => [...prev, response.data!]);
        return response.data;
      }
      return null;
    } catch (err: any) {
      console.error('[usePriceAlerts] Error creating alert:', err);
      throw err;
    }
  }, []);

  const updateAlert = useCallback(async (id: string, input: UpdatePriceAlertInput): Promise<PriceAlert | null> => {
    try {
      const response = await apiClient.put<PriceAlert>(`/api/alerts/${id}`, input);
      if (response.success && response.data) {
        setAlerts(prev => prev.map(alert => alert.id === id ? response.data! : alert));
        return response.data;
      }
      return null;
    } catch (err: any) {
      console.error('[usePriceAlerts] Error updating alert:', err);
      throw err;
    }
  }, []);

  const deleteAlert = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await apiClient.delete<{ success: boolean }>(`/api/alerts/${id}`);
      if (response.success) {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[usePriceAlerts] Error deleting alert:', err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    isLoading,
    error,
    fetchAlerts,
    createAlert,
    updateAlert,
    deleteAlert,
  };
}

