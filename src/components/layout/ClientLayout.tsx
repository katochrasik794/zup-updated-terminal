'use client';

import React from 'react';
import Navbar from './Navbar';
import { SidebarProvider, useSidebar } from '../../context/SidebarContext';

function LayoutContent({ children }: { children: React.ReactNode }) {
    const { isSidebarExpanded } = useSidebar();

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
