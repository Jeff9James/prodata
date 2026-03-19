"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
    Globe,
    Package,
    TrendingUp,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Users,
} from "lucide-react";
import { useMemo } from "react";
import type { CountryRevenue } from "@/hooks/use-metrics";
import type { GroupedProductRevenue } from "@/hooks/use-metrics";
import type { PlatformAttribution } from "@/hooks/use-metrics";

interface InsightCardsProps {
    countryData?: CountryRevenue[];
    productData?: GroupedProductRevenue[];
    platformData?: PlatformAttribution[];
    totalRevenue?: number;
    totalOrders?: number;
    totalCustomers?: number;
    loading?: boolean;
    currency?: string;
}

interface Insight {
    id: string;
    type: "success" | "info" | "warning";
    title: string;
    description: string;
    icon: React.ReactNode;
}

export function InsightCards({
    countryData = [],
    productData = [],
    platformData = [],
    totalRevenue = 0,
    totalOrders = 0,
    totalCustomers = 0,
    loading = false,
    currency = "USD",
}: InsightCardsProps) {
    const insights = useMemo<Insight[]>(() => {
        const result: Insight[] = [];

        // Helper to calculate top country revenue
        const topRevenue = countryData[0]?.revenue || 0;

        // Top Country Insight
        if (countryData.length > 0) {
            const topCountry = countryData[0];
            if (topCountry && topCountry.percentage > 0) {
                result.push({
                    id: "top-country",
                    type: topCountry.percentage > 50 ? "warning" : "info",
                    title: `Top Country: ${topCountry.countryName || topCountry.country}`,
                    description: `${topCountry.percentage.toFixed(0)}% of revenue (${formatCurrency(topRevenue, currency)})`,
                    icon: <Globe className="h-4 w-4" />,
                });
            }
        }

        // Best Seller Product Insight
        if (productData.length > 0) {
            const topProduct = productData[0];
            if (topProduct) {
                result.push({
                    id: "best-seller",
                    type: "success",
                    title: `Best-seller: ${topProduct.productName}`,
                    description: `${formatCurrency(topProduct.revenue, currency)} (${topProduct.percentage.toFixed(1)}% of revenue)`,
                    icon: <Package className="h-4 w-4" />,
                });
            }
        }

        // Platform Concentration Insight
        if (platformData.length > 0) {
            const topPlatform = platformData[0];
            if (topPlatform && topPlatform.percentage > 0) {
                const isConcentrated = topPlatform.percentage > 70;
                result.push({
                    id: "platform-concentration",
                    type: isConcentrated ? "warning" : "info",
                    title: `Primary Platform: ${topPlatform.platform.charAt(0).toUpperCase() + topPlatform.platform.slice(1)}`,
                    description: `${topPlatform.percentage.toFixed(0)}% of revenue comes from ${topPlatform.platform}`,
                    icon: <TrendingUp className="h-4 w-4" />,
                });
            }

            // Multi-platform diversity
            if (platformData.length >= 2) {
                const topTwo = platformData.slice(0, 2);
                const combinedPercent = topTwo.reduce((sum, p) => sum + p.percentage, 0);
                if (combinedPercent < 80) {
                    result.push({
                        id: "platform-diversity",
                        type: "success",
                        title: "Diversified Revenue",
                        description: `Revenue spread across ${platformData.length} platforms`,
                        icon: <CheckCircle2 className="h-4 w-4" />,
                    });
                }
            }
        }

        // Revenue health
        if (totalRevenue > 0) {
            if (totalRevenue > 10000) {
                result.push({
                    id: "high-revenue",
                    type: "success",
                    title: "Strong Revenue",
                    description: `$${(totalRevenue / 1000).toFixed(1)}K total revenue`,
                    icon: <DollarSign className="h-4 w-4" />,
                });
            }
        }

        // Customer insight
        if (totalCustomers > 0) {
            const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            result.push({
                id: "avg-order-value",
                type: "info",
                title: "Average Order Value",
                description: `${formatCurrency(avgOrderValue, currency)} per order`,
                icon: <Users className="h-4 w-4" />,
            });
        }

        // Missing data insights
        if (countryData.length === 0 && !loading) {
            result.push({
                id: "no-country-data",
                type: "warning",
                title: "Country Data Missing",
                description: "Add country information to enable geographic insights",
                icon: <AlertCircle className="h-4 w-4" />,
            });
        }

        return result;
    }, [countryData, productData, platformData, totalRevenue, totalOrders, totalCustomers, currency, loading]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Insights</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (insights.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Insights</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Not enough data to generate insights yet.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const typeStyles = {
        success: "border-l-4 border-l-green-500 bg-green-500/5",
        info: "border-l-4 border-l-blue-500 bg-blue-500/5",
        warning: "border-l-4 border-l-amber-500 bg-amber-500/5",
    };

    const iconColors = {
        success: "text-green-500",
        info: "text-blue-500",
        warning: "text-amber-500",
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Insights</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {insights.map((insight) => (
                        <div
                            key={insight.id}
                            className={`rounded-lg border p-3 ${typeStyles[insight.type]}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 ${iconColors[insight.type]}`}>
                                    {insight.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{insight.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {insight.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
