import { useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { usePriceAlerts, PriceAlert } from './usePriceAlerts';
import { apiClient } from '@/lib/api';

/**
 * Hook to monitor price alerts and trigger notifications when conditions are met
 */
export function usePriceAlertMonitor(accountId?: string) {
  const { lastQuotes, normalizeSymbol, subscribe, unsubscribe } = useWebSocket();
  const { alerts, fetchAlerts } = usePriceAlerts(accountId);
  const triggeredAlertsRef = useRef<Set<string>>(new Set());

  // Subscribe to symbols for active alerts
  useEffect(() => {
    const activeAlerts = alerts.filter(alert => alert.isActive && !alert.notificationSent);
    const symbols = activeAlerts.map(alert => alert.symbol);
    
    if (symbols.length > 0) {
      subscribe(symbols);
    }

    return () => {
      if (symbols.length > 0) {
        unsubscribe(symbols);
      }
    };
  }, [alerts, subscribe, unsubscribe]);

  // Play alert sound
  const playAlertSound = () => {
    try {
      // Create audio context for alert sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure alert sound (beep pattern)
      oscillator.frequency.value = 800; // Higher pitch
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Play second beep after short delay
      setTimeout(() => {
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator2.frequency.value = 800;
        oscillator2.type = 'sine';
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator2.start(audioContext.currentTime);
        oscillator2.stop(audioContext.currentTime + 0.5);
      }, 200);
    } catch (error) {
      console.warn('[usePriceAlertMonitor] Failed to play alert sound:', error);
    }
  };

  // Show browser notification
  const showNotification = (alert: PriceAlert, currentPrice: number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const conditionText = alert.condition === 'above' ? 'above' : 'below';
      new Notification(`Price Alert: ${alert.symbol}`, {
        body: `${alert.symbol} price is ${conditionText} ${alert.targetPrice}. Current: ${currentPrice}`,
        icon: '/logo-icon.webp',
        tag: alert.id, // Prevent duplicate notifications
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(err => {
        console.warn('[usePriceAlertMonitor] Failed to request notification permission:', err);
      });
    }
  }, []);

  // Monitor alerts against current prices
  useEffect(() => {
    const activeAlerts = alerts.filter(alert => alert.isActive && !alert.notificationSent);
    
    if (activeAlerts.length === 0) return;

    activeAlerts.forEach(alert => {
      const normalizedSymbol = normalizeSymbol(alert.symbol);
      const quote = lastQuotes[normalizedSymbol] || lastQuotes[alert.symbol];

      if (!quote) return;

      // Use mid price (average of bid and ask)
      const currentPrice = (quote.bid + quote.ask) / 2;
      let shouldTrigger = false;

      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger && !triggeredAlertsRef.current.has(alert.id)) {
        triggeredAlertsRef.current.add(alert.id);

        // Trigger alert on backend
        apiClient.post(`/api/alerts/${alert.id}/trigger`, {}).catch(err => {
          console.error('[usePriceAlertMonitor] Failed to trigger alert on backend:', err);
        });

        // Play sound
        playAlertSound();

        // Show notification
        showNotification(alert, currentPrice);

        // Refresh alerts to update UI
        setTimeout(() => {
          fetchAlerts();
        }, 1000);
      }
    });
  }, [alerts, lastQuotes, normalizeSymbol, fetchAlerts]);

  return {
    alerts,
  };
}

