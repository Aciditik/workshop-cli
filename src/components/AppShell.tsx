"use client";

import { AuthProvider, useAuth } from "@/lib/auth";
import { Trophy, LayoutDashboard, PlusCircle, LogOut, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
          <p className="text-muted-foreground">Chargement...</p>
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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border glass flex flex-col z-10 shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg shadow-lg shadow-primary/30">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
            CDF Terraforming Mars
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors group"
          >
            <LayoutDashboard className="w-5 h-5 group-hover:text-primary transition-colors" />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link
            href="/tournaments/new"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors group"
          >
            <PlusCircle className="w-5 h-5 group-hover:text-primary transition-colors" />
            <span className="font-medium">New Tournament</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-border/50 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <div className="flex items-center gap-1">
                {user?.role === "admin" && (
                  <Shield className="w-3 h-3 text-yellow-500" />
                )}
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
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
      <main className="flex-1 overflow-y-auto relative z-0">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        <div className="max-w-6xl mx-auto p-8 relative">{children}</div>
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
