"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, DollarSign, ShoppingBag, Globe } from "lucide-react";

interface Sale {
    id: string;
    accountId: string;
    projectId: string | null;
    platform: string;
    productName: string;
    productId: string | null;
    amount: number;
    currency: string;
    country: string | null;
    countryName: string | null;
    timestamp: string;
    metadata: any;
    createdAt: string;
}

interface SalesResponse {
    sales: Sale[];
    accounts: Record<string, string>;
    projects: Record<string, string>;
}

const PLATFORM_COLORS: Record<string, string> = {
    gumroad: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    amazon: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    stripe: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    revenuecat: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    gumroad: <ShoppingBag className="w-4 h-4" />,
    amazon: <ShoppingBag className="w-4 h-4" />,
    stripe: <DollarSign className="w-4 h-4" />,
    revenuecat: <Activity className="w-4 h-4" />,
};

export function LiveFeed({ limit = 10 }: { limit?: number }) {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const { enabledAccountIds, refetchAll } = useDashboardData();

    useEffect(() => {
        fetchSales();
    }, [enabledAccountIds]);

    // Poll for new sales every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchSales();
        }, 30000);

        return () => clearInterval(interval);
    }, [enabledAccountIds]);

    const fetchSales = async () => {
        try {
            const params = new URLSearchParams();
            params.set("limit", String(limit));
            const accountIdsArray = Array.from(enabledAccountIds);
            if (accountIdsArray.length > 0) {
                params.set("accountIds", accountIdsArray.join(","));
            }

            const response = await fetch(`/api/sales?${params.toString()}`);
            const data: SalesResponse = await response.json();
            setSales(data.sales);
        } catch (error) {
            console.error("Failed to fetch sales:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const formatTime = (timestamp: string) => {
        return format(new Date(timestamp), "h:mm a");
    };

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Live Feed
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className="w-2 h-2 bg-muted-foreground/30 rounded-full animate-pulse" />
                                <div className="flex-1 space-y-1">
                                    <div className="h-3 bg-muted-foreground/20 rounded w-3/4" />
                                    <div className="h-2 bg-muted-foreground/10 rounded w-1/2" />
                                </div>
                                <div className="h-3 bg-muted-foreground/20 rounded w-16" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (sales.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Live Feed
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        No recent sales to display
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Live Feed
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {sales.map((sale) => (
                        <div
                            key={sale.id}
                            className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">{sale.productName}</span>
                                    <Badge className={PLATFORM_COLORS[sale.platform] || "bg-gray-100 text-gray-800"}>
                                        {sale.platform}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span>{formatTime(sale.timestamp)}</span>
                                    {sale.country && (
                                        <span className="flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            {sale.countryName || sale.country}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="font-medium text-sm">
                                {formatCurrency(sale.amount, sale.currency)}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
