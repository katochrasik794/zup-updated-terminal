'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';

function LayoutContent({ children }: { children: React.ReactNode }) {
    const { isSidebarExpanded } = useSidebar();
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    // For login page, don't show Navbar - let the page handle its own layout
    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden gap-1">
            <Navbar
                logoLarge="/logo-full.png"
                logoSmall="/logo-icon.webp"
            />
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
}

import { WebSocketProvider } from '../../context/WebSocketContext';
import { TradingProvider } from '../../context/TradingContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <WebSocketProvider>
                <TradingProvider>
                    <LayoutContent>{children}</LayoutContent>
                </TradingProvider>
            </WebSocketProvider>
        </SidebarProvider>
    );
}
