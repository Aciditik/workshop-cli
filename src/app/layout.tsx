import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Trophy, LayoutDashboard, PlusCircle } from "lucide-react";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tournament Manager Pro",
  description: "Manage your tournaments with style",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 border-r border-border glass flex flex-col z-10 shrink-0">
            <div className="p-6 flex items-center gap-3">
              <div className="bg-primary p-2 rounded-lg shadow-lg shadow-primary/30">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">TournaPro</h1>
            </div>

            <nav className="flex-1 px-4 space-y-2 mt-4">
              <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors group">
                <LayoutDashboard className="w-5 h-5 group-hover:text-primary transition-colors" />
                <span className="font-medium">Dashboard</span>
              </Link>
              <Link href="/tournaments/new" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors group">
                <PlusCircle className="w-5 h-5 group-hover:text-primary transition-colors" />
                <span className="font-medium">New Tournament</span>
              </Link>
            </nav>

            <div className="p-4 border-t border-border/50">
              <div className="text-xs text-muted-foreground text-center">
                Tournament Manager v1.0
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto relative z-0">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
            <div className="max-w-6xl mx-auto p-8 relative">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
