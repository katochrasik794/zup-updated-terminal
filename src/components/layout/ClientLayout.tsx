'use client';

import React from 'react';
import Navbar from './Navbar';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';
import { usePathname } from 'next/navigation';

function LayoutContent({ children }: { children: React.ReactNode }) {
    const { isSidebarExpanded } = useSidebar();
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    if (isLoginPage) {
        return <div className="h-screen w-full bg-[#02040d] overflow-auto">{children}</div>;
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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <LayoutContent>{children}</LayoutContent>
        </SidebarProvider>
    );
}
