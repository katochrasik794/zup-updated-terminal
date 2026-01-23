import "./globals.css";
import ClientLayout from "../components/layout/ClientLayout";

export const metadata = {
    title: "Zuperior Terminal",
    description: "Next.js migrated trading terminal",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="antialiased">
                <ClientLayout>
                    {children}
                </ClientLayout>
            </body>
        </html>
    );
}
