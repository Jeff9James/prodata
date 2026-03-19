"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Package, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMemo } from "react";
import type { GroupedProductRevenue } from "@/hooks/use-metrics";
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

const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
];

interface RevenueByProductChartProps {
    data: GroupedProductRevenue[];
    totalRevenue: number;
    totalOrders: number;
    loading?: boolean;
    maxProducts?: number;
    currency?: string;
}

export function RevenueByProductChart({
    data,
    totalRevenue,
    totalOrders,
    loading = false,
    maxProducts = 10,
    currency = "USD",
}: RevenueByProductChartProps) {
    // Prepare chart data
    const chartData = useMemo(() => {
        return data.slice(0, maxProducts).map((product, i) => ({
            name: product.productName.length > 25
                ? product.productName.slice(0, 25) + "..."
                : product.productName,
            fullName: product.productName,
            revenue: product.revenue,
            orders: product.orders,
            percentage: product.percentage,
            platforms: product.platforms,
            color: CHART_COLORS[i % CHART_COLORS.length],
        }));
    }, [data, maxProducts]);

    // Platform colors
    const platformColors: Record<string, string> = {
        amazon: "#FF9900",
        gumroad: "#00FF00",
        stripe: "#635BFF",
        revenuecat: "#9955FF",
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Revenue by Product
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Revenue by Product
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No revenue data by product available.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Revenue by Product
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Table view */}
                <div className="rounded-md border">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b bg-muted/50 text-xs">
                                <th className="px-3 py-2 text-left font-medium">Product</th>
                                <th className="px-3 py-2 text-left font-medium">Platforms</th>
                                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                                <th className="px-3 py-2 text-right font-medium">Orders</th>
                                <th className="px-3 py-2 text-right font-medium">%</th>
                                <th className="px-3 py-2 text-center font-medium">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map((product, i) => (
                                <tr key={product.fullName} className="border-b last:border-0">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: product.color }}
                                            />
                                            <span className="text-sm" title={product.fullName}>
                                                {product.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex gap-1">
                                            {product.platforms.map((platform) => (
                                                <span
                                                    key={platform}
                                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                                                    style={{
                                                        backgroundColor: platformColors[platform] || "#888",
                                                        color: "#fff",
                                                    }}
                                                >
                                                    {platform}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm font-medium">
                                        {formatCurrency(product.revenue, currency)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm">
                                        {formatNumber(product.orders)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                                        {product.percentage.toFixed(1)}%
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="w-24 ml-auto">
                                            <BreakdownBar
                                                percentage={product.percentage}
                                                barClassName="bg-primary"
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary */}
                <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {data.length} product{data.length !== 1 ? "s" : ""}
                        </span>
                        <span className="font-medium">
                            Total: {formatCurrency(totalRevenue, currency)} ({formatNumber(totalOrders)} orders)
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
