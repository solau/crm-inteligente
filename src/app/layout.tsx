import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRM.IA - Vendas & Retenção",
  description: "O maior CRM inteligente do mundo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased flex flex-col md:flex-row selection:bg-primary/30`}>
        {/* Navigation (Sidebar Desktop + Bottom Nav Mobile) */}
        <Sidebar />
        
        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 md:pb-0 h-[100dvh] md:h-screen">
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 lg:p-12">
            <div className="mx-auto max-w-7xl h-full">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
