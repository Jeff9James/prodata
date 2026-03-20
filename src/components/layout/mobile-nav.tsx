"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, RefreshCw, ArrowUpCircle, Wallet } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BlurToggle } from "@/components/ui/blur-toggle";

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

export function MobileNav() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    // Hide mobile nav on auth pages
    if (pathname.startsWith("/auth/")) {
        return null;
    }

    return (
        <header className="md:hidden flex h-14 items-center justify-between border-b border-border bg-card px-4">
            <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                    Oh
                </div>
                <span className="text-sm font-semibold tracking-tight">
                    OhMyDashboard
                </span>
            </div>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <div className="flex h-full flex-col">
                        {/* Header */}
                        <div className="flex h-14 items-center justify-between border-b border-border px-4">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                                    Oh
                                </div>
                                <span className="text-sm font-semibold tracking-tight">
                                    OhMyDashboard
                                </span>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 space-y-1 p-3">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setOpen(false)}
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

                        {/* Theme + Blur + Sync */}
                        <div className="border-t border-border p-3 space-y-2">
                            <ThemeToggle />
                            <BlurToggle />
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start gap-2"
                                onClick={async () => {
                                    try {
                                        await apiPost("/api/sync");
                                    } catch (error) {
                                        console.error("Sync failed:", error);
                                    }
                                }}
                            >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Sync All
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </header>
    );
}
