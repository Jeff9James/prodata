"use client";

import { useDashboardData } from "@/hooks/use-dashboard-data";
import { CogsManager } from "@/components/dashboard/cogs-manager";
import { GoalsManager } from "@/components/dashboard/goals-manager";
import { NetProfitCard } from "@/components/dashboard/net-profit-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Target, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

interface SaleData {
    productId: string;
    platform: string;
    productName: string;
    amount: number;
    currency: string;
}

export default function ProfitSettingsPage() {
    const {
        loading,
        enabledAccountIds,
        currentTotals,
    } = useDashboardData();

    const [salesData, setSalesData] = useState<SaleData[]>([]);
    const [salesLoading, setSalesLoading] = useState(true);

    // Fetch actual sales data for profit calculations
    useEffect(() => {
        async function fetchSalesData() {
            const accountIdArray = Array.from(enabledAccountIds);
            if (accountIdArray.length === 0) {
                setSalesLoading(false);
                return;
            }

            try {
                const params = new URLSearchParams();
                params.set("accountIds", accountIdArray.join(","));
                params.set("limit", "1000");

                const response = await fetch(`/api/sales?${params}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch sales");
                }

                const data = await response.json();
                const sales: SaleData[] = (data.sales || []).map((sale: {
                    productId: string;
                    platform: string;
                    productName: string;
                    amount: number;
                    currency: string;
                }) => ({
                    productId: sale.productId || "",
                    platform: sale.platform || "",
                    productName: sale.productName || "",
                    amount: sale.amount || 0,
                    currency: sale.currency || "USD",
                }));

                setSalesData(sales);
            } catch (error) {
                console.error("Error fetching sales data:", error);
            } finally {
                setSalesLoading(false);
            }
        }

        fetchSalesData();
    }, [enabledAccountIds]);

    const isLoading = loading || salesLoading;

    return (
        <div className="p-6 lg:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Profit & Goals</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your product costs, set revenue targets, and track net profit.
                </p>
            </div>

            {/* Net Profit Overview */}
            <div className="mb-6">
                <NetProfitCard
                    totalRevenue={currentTotals.revenue}
                    platformFees={currentTotals.platformFees}
                    salesData={salesData}
                    currency={currentTotals.currency}
                    loading={isLoading}
                />
            </div>

            {/* Tabs for COGS and Goals */}
            <Tabs defaultValue="goals" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="goals" className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Goals
                    </TabsTrigger>
                    <TabsTrigger value="costs" className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Product Costs
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="goals" className="space-y-4">
                    <GoalsManager
                        currentRevenue={currentTotals.revenue}
                        currentMrr={currentTotals.mrr}
                        currentSalesCount={currentTotals.salesCount}
                        currentCustomers={currentTotals.newCustomers}
                        currency={currentTotals.currency}
                    />
                </TabsContent>

                <TabsContent value="costs" className="space-y-4">
                    <CogsManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
