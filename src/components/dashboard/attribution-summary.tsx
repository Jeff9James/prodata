"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import type { PlatformAttribution, AttributionBreakdown } from "@/hooks/use-metrics";
import { BreakdownBar } from "@/components/dashboard/breakdown-bar";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
} from "recharts";

const PLATFORM_COLORS: Record<string, string> = {
    amazon: "#FF9900",
    gumroad: "#00FF00",
    stripe: "#635BFF",
    revenuecat: "#9955FF",
};

const PLATFORM_NAMES: Record<string, string> = {
    amazon: "Amazon",
    gumroad: "Gumroad",
    stripe: "Stripe",
    revenuecat: "RevenueCat",
};

interface AttributionSummaryProps {
    platforms: PlatformAttribution[];
    breakdown?: AttributionBreakdown;
    totalRevenue: number;
    totalOrders: number;
    loading?: boolean;
    currency?: string;
}

export function AttributionSummary({
    platforms,
    breakdown,
    totalRevenue,
    totalOrders,
    loading = false,
    currency = "USD",
}: AttributionSummaryProps) {
    // Prepare chart data
    const chartData = useMemo(() => {
        return platforms.map((p) => ({
            name: PLATFORM_NAMES[p.platform] || p.platform,
            platform: p.platform,
            revenue: p.revenue,
            orders: p.orders,
            percentage: p.percentage,
            color: PLATFORM_COLORS[p.platform] || "#888",
        }));
    }, [platforms]);

    // Get top countries from breakdown
    const topCountries = useMemo(() => {
        if (breakdown?.type !== "country" || !breakdown?.data) return [];
        return Object.entries(breakdown.data)
            .sort(([, a], [, b]) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5)
            .map(([country, data]) => ({
                country,
                countryName: data.countryName,
                totalRevenue: data.totalRevenue,
                platforms: data.platforms,
            }));
    }, [breakdown]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Platform Attribution
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (platforms.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Platform Attribution
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No platform attribution data available.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Platform Attribution
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Platform breakdown */}
                <div>
                    <h3 className="text-sm font-medium mb-3">Revenue by Platform</h3>
                    <div className="space-y-3">
                        {chartData.map((platform) => (
                            <div key={platform.platform} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: platform.color }}
                                        />
                                        <span className="font-medium">{platform.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-muted-foreground">
                                            {formatCurrency(platform.revenue, currency)}
                                        </span>
                                        <span className="text-muted-foreground">
                                            ({platform.percentage.toFixed(1)}%)
                                        </span>
                                    </div>
                                </div>
                                <BreakdownBar
                                    percentage={platform.percentage}
                                    barClassName="bg-primary"
                                    containerClassName="h-2"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Summary */}
                <div className="pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {platforms.length} platform{platforms.length !== 1 ? "s" : ""}
                        </span>
                        <span className="font-medium">
                            Total: {formatCurrency(totalRevenue, currency)} ({formatNumber(totalOrders)} orders)
                        </span>
                    </div>
                </div>

                {/* Country breakdown if available */}
                {breakdown?.type === "country" && topCountries.length > 0 && (
                    <div className="pt-4 border-t">
                        <h3 className="text-sm font-medium mb-3">Top Countries by Platform</h3>
                        <div className="rounded-md border">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50 text-xs">
                                        <th className="px-3 py-2 text-left font-medium">Country</th>
                                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                                        <th className="px-3 py-2 text-left font-medium">Platforms</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topCountries.map((country) => (
                                        <tr key={country.country} className="border-b last:border-0">
                                            <td className="px-3 py-2 text-sm">
                                                {country.countryName || country.country}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-medium">
                                                {formatCurrency(country.totalRevenue, currency)}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-1 flex-wrap">
                                                    {country.platforms.map((p) => (
                                                        <span
                                                            key={p.platform}
                                                            className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                                                            style={{
                                                                backgroundColor: PLATFORM_COLORS[p.platform] || "#888",
                                                                color: "#fff",
                                                            }}
                                                        >
                                                            {PLATFORM_NAMES[p.platform] || p.platform}: {p.percentage.toFixed(0)}%
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
