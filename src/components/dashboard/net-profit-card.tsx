"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useProductCogs } from "@/hooks/use-cogs";
import { DollarSign, TrendingUp, TrendingDown, Minus, Wallet } from "lucide-react";

interface NetProfitCardProps {
    totalRevenue: number;
    platformFees: number;
    salesData?: Array<{
        productId: string;
        platform: string;
        productName: string;
        amount: number;
        currency: string;
    }>;
    currency?: string;
    loading?: boolean;
}

export function NetProfitCard({
    totalRevenue,
    platformFees,
    salesData = [],
    currency = "USD",
    loading = false,
}: NetProfitCardProps) {
    const { cogs, loading: cogsLoading } = useProductCogs();

    const profitData = useMemo(() => {
        // Calculate estimated COGS from sales data
        let totalCogs = 0;
        let totalEstimatedFees = 0;

        // Ensure cogs is always an array
        const safeCogs = Array.isArray(cogs) ? cogs : [];

        // Create a map for quick COGS lookup
        const cogsMap = new Map(
            safeCogs.map((c) => [`${c.platform}-${c.productId}`, c])
        );

        // Calculate per-sale COGS and fees
        for (const sale of salesData) {
            const key = `${sale.platform}-${sale.productId}`;
            const cogEntry = cogsMap.get(key);

            if (cogEntry) {
                // Add COGS (assuming 1 unit per sale for simplicity)
                totalCogs += cogEntry.cogsAmount;

                // Calculate estimated fee percentage on the sale amount
                const feeAmount = sale.amount * (cogEntry.estimatedFeePercent / 100);
                totalEstimatedFees += feeAmount;
            }
        }

        // If we have sales data but no COGS configured, we can't calculate precise profit
        // So we use the platformFees from metrics as a fallback
        const effectiveFees = totalEstimatedFees > 0
            ? totalEstimatedFees
            : platformFees;

        const grossRevenue = totalRevenue;
        const netProfit = grossRevenue - effectiveFees - totalCogs;
        const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

        return {
            grossRevenue,
            platformFees: effectiveFees,
            cogs: totalCogs,
            netProfit,
            profitMargin,
            hasCogsConfigured: safeCogs.length > 0,
            calculatedFromSales: totalEstimatedFees > 0,
        };
    }, [cogs, salesData, platformFees, totalRevenue]);

    if (loading || cogsLoading) {
        return (
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Net Profit
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-4 w-24 mt-2" />
                </CardContent>
            </Card>
        );
    }

    const isPositive = profitData.netProfit >= 0;
    const isBreakEven = profitData.netProfit === 0;

    return (
        <Card className={!isPositive ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Net Profit
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-baseline gap-2">
                    <span
                        className={`text-2xl font-bold ${isBreakEven
                            ? "text-muted-foreground"
                            : isPositive
                                ? "text-green-600 dark:text-green-400"
                                : "text-destructive"
                            }`}
                    >
                        {formatCurrency(profitData.netProfit, currency)}
                    </span>
                    {isPositive && !isBreakEven && (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                    {isBreakEven && <Minus className="h-4 w-4 text-muted-foreground" />}
                    {!isPositive && !isBreakEven && (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                </div>

                {/* Breakdown */}
                <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Gross Revenue</span>
                        <span>{formatCurrency(profitData.grossRevenue, currency)}</span>
                    </div>

                    {profitData.platformFees > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Platform Fees</span>
                            <span className="text-amber-600">
                                -{formatCurrency(profitData.platformFees, currency)}
                            </span>
                        </div>
                    )}

                    {profitData.cogs > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>COGS</span>
                            <span className="text-red-600">
                                -{formatCurrency(profitData.cogs, currency)}
                            </span>
                        </div>
                    )}

                    <div className="flex justify-between font-medium pt-1 border-t">
                        <span>Net Profit</span>
                        <span
                            className={
                                isBreakEven
                                    ? "text-muted-foreground"
                                    : isPositive
                                        ? "text-green-600"
                                        : "text-destructive"
                            }
                        >
                            {formatCurrency(profitData.netProfit, currency)}
                        </span>
                    </div>

                    {/* Profit Margin */}
                    <div className="flex justify-between text-muted-foreground pt-1">
                        <span>Margin</span>
                        <span
                            className={
                                isBreakEven
                                    ? "text-muted-foreground"
                                    : isPositive
                                        ? "text-green-600"
                                        : "text-destructive"
                            }
                        >
                            {profitData.profitMargin.toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Note about profit calculation */}
                {!profitData.hasCogsConfigured && !profitData.calculatedFromSales && (
                    <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                        Add product costs to see accurate net profit.
                    </p>
                )}

                {profitData.calculatedFromSales && (
                    <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                        Profit calculated from configured product costs.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
