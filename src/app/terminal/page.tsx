'use client';

import TradingTerminal from '../../components/trading/TradingTerminal';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/ui/loading-wave';

export default function TerminalPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return <TradingTerminal />;
}
