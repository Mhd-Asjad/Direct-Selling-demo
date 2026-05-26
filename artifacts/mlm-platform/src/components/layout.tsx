import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogoutUser, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Network,
  DollarSign,
  Wallet,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/network", label: "Network", icon: Network },
  { href: "/commissions", label: "Commissions", icon: DollarSign },
  { href: "/wallet", label: "E-Wallet", icon: Wallet },
];

const adminItems = [
  { href: "/admin", label: "Admin Nexus", icon: ShieldCheck },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const logout = useLogoutUser({
    mutation: {
      onSuccess: () => {
        // Remove the query entirely so it won't refetch before redirect
        queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
        // Clear all cached query data to prevent stale data showing after re-login
        queryClient.clear();
        setLocation("/login");
      },
    },
  });

  const handleLogout = () => {
    logout.mutate();
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Network className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-none">NetPro</p>
            <p className="text-xs text-muted-foreground mt-0.5">Direct Selling</p>
          </div>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="px-4 py-3 mx-3 mt-3 rounded-lg bg-sidebar-accent border border-sidebar-border">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={cn(
              "inline-block w-1.5 h-1.5 rounded-full",
              user.status === "active" ? "bg-accent" : user.status === "pending" ? "bg-yellow-500" : "bg-destructive"
            )} />
            <span className="text-xs text-muted-foreground capitalize">{user.status}</span>
            {isAdmin && (
              <span className="ml-auto text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">Admin</span>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-4 space-y-0.5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Main</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mt-4 mb-2">Administration</p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href || location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  data-testid={`nav-admin`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Referral link */}
      {user?.status === "active" && (
        <div className="px-3 mb-3">
          <div className="px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs font-semibold text-primary mb-1">Your Referral Link</p>
            <p className="text-xs text-muted-foreground font-mono truncate">?ref={user.referralCode}</p>
            <button
              data-testid="button-copy-referral"
              onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${import.meta.env.BASE_URL}register?ref=${user.referralCode}`)}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              Copy link
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <button
          data-testid="button-logout"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <NavContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full flex flex-col bg-sidebar border-r border-sidebar-border">
            <button
              className="absolute top-4 right-4 text-muted-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            data-testid="button-mobile-menu"
            onClick={() => setMobileOpen(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">NetPro</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
