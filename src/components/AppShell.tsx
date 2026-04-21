"use client";

import { AuthProvider, useAuth } from "@/lib/auth";
import { Trophy, LayoutDashboard, PlusCircle, LogOut, Shield, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/login" && !pathname.startsWith("/t/")) {
      router.push("/login");
    }
  }, [isLoading, user, pathname, router]);

  // Public pages (login, public tournament view /t/...)
  if (pathname === "/login" || pathname.startsWith("/t/")) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Trophy className="w-12 h-12 text-primary opacity-50" />
          <p className="text-muted-foreground font-prototype">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 w-64 border-r border-border glass flex flex-col z-30 shrink-0 transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 relative shrink-0">
            <Image 
              src="/cdf-logo.png" 
              alt="CdF Logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-prototype bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
            CdF Terraforming Mars
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden p-1 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors group"
          >
            <LayoutDashboard className="w-5 h-5 group-hover:text-primary transition-colors" />
            <span className="font-prototype">Tableau de bord</span>
          </Link>
          <Link
            href="/tournaments/new"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors group"
          >
            <PlusCircle className="w-5 h-5 group-hover:text-primary transition-colors" />
            <span className="font-prototype">Nouveau tournoi</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-prototype shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-prototype truncate">{user?.name}</p>
              <div className="flex items-center gap-1">
                {user?.role === "admin" && (
                  <Shield className="w-3 h-3 text-yellow-500" />
                )}
                <p className="text-xs font-prototype text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-0 w-full">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-10 flex items-center justify-between p-3 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md hover:bg-accent text-foreground"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative shrink-0">
              <Image 
                src="/cdf-logo.png" 
                alt="CdF Logo"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span className="text-sm font-prototype">CdF Terraforming Mars</span>
          </div>
          <div className="w-9" aria-hidden="true" />
        </div>

        <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8 relative">{children}</div>
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
