"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Settings, RefreshCw, ArrowUpCircle, TrendingUp, Wallet, LogOut, User } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BlurToggle } from "@/components/ui/blur-toggle";
import { useUpdateCheck } from "@/hooks/use-update-check";
import { useAuth } from "@/components/auth/auth-check";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Profit & Goals",
    href: "/settings/profit",
    icon: Wallet,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const update = useUpdateCheck();
  const { user } = useAuth();

  // Hide sidebar on auth pages
  if (pathname.startsWith("/auth/")) {
    return null;
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/signin");
    router.refresh();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiPost("/api/sync");
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
          Oh
        </div>
        <span className="text-sm font-semibold tracking-tight">
          OhMyDashboard
        </span>
      </div>

      {/* User Info */}
      {user && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Update banner */}
      {update?.updateAvailable && (
        <div className="mx-3 rounded-md border border-border bg-accent/50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-accent-foreground">
            <ArrowUpCircle className="h-3.5 w-3.5 shrink-0" />
            Update available
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            v{update.latest} is out (you have v{update.current})
          </p>
          <code className="mt-2 block rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
            git pull && pnpm install
          </code>
        </div>
      )}

      {/* Theme + Blur + Sync */}
      <div className="border-t border-border p-3 space-y-2">
        <ThemeToggle />
        <BlurToggle />
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          {syncing ? "Syncing..." : "Sync All"}
        </Button>
      </div>
    </aside>
  );
}
