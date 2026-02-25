import "./globals.css";
import React from 'react';
import ClientLayout from "../components/layout/ClientLayout";
import { PrivacyProvider } from "../context/PrivacyContext";
import { AuthProvider } from "../context/AuthContext";
import { AccountProvider } from "../context/AccountContext";
import { InstrumentProvider } from "../context/InstrumentContext";
import { ThemeProvider } from "../context/ThemeContext";

export const metadata = {
    title: "Zuperior Terminal",
    description: "Next.js migrated trading terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="antialiased" suppressHydrationWarning>
                <AuthProvider>
                    <AccountProvider>
                        <InstrumentProvider>
                            <PrivacyProvider>
                                <ThemeProvider>
                                    <ClientLayout>
                                        {children}
                                    </ClientLayout>
                                </ThemeProvider>
                            </PrivacyProvider>
                        </InstrumentProvider>
                    </AccountProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
