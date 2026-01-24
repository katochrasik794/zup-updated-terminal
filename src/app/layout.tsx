import "./globals.css";
import React from 'react';
import ClientLayout from "../components/layout/ClientLayout";
import { PrivacyProvider } from "../context/PrivacyContext";

export const metadata = {
    title: "Zuperior Terminal",
    description: "Next.js migrated trading terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className="antialiased">
                <PrivacyProvider>
                    <ClientLayout>
                        {children}
                    </ClientLayout>
                </PrivacyProvider>
            </body>
        </html>
    );
}
