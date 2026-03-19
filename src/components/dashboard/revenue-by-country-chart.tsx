"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Globe } from "lucide-react";
import { useMemo } from "react";
import type { CountryRevenue } from "@/hooks/use-metrics";
import { BreakdownBar } from "@/components/dashboard/breakdown-bar";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
} from "recharts";

const CHART_COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--chart-7)",
    "var(--chart-8)",
];

interface RevenueByCountryChartProps {
    data: CountryRevenue[];
    totalRevenue: number;
    totalOrders: number;
    loading?: boolean;
    maxCountries?: number;
    currency?: string;
}

export function RevenueByCountryChart({
    data,
    totalRevenue,
    totalOrders,
    loading = false,
    maxCountries = 10,
    currency = "USD",
}: RevenueByCountryChartProps) {
    // Prepare pie chart data (top countries)
    const pieData = useMemo(() => {
        const topCountries = data.slice(0, maxCountries);
        const otherRevenue = data
            .slice(maxCountries)
            .reduce((sum, c) => sum + c.revenue, 0);

        const result = topCountries.map((c, i) => ({
            name: c.countryName || c.country,
            value: c.revenue,
            percentage: c.percentage,
            color: CHART_COLORS[i % CHART_COLORS.length],
        }));

        if (otherRevenue > 0) {
            result.push({
                name: "Other",
                value: otherRevenue,
                percentage: (otherRevenue / totalRevenue) * 100,
                color: "var(--chart-muted)",
            });
        }

        return result;
    }, [data, totalRevenue, maxCountries]);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Revenue by Country
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-8 w-full" />
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
                        <Globe className="h-4 w-4" />
                        Revenue by Country
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No revenue data by country available.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Revenue by Country
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="table" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="table">Table</TabsTrigger>
                        <TabsTrigger value="chart">Pie Chart</TabsTrigger>
                    </TabsList>

                    <TabsContent value="table" className="space-y-3">
                        <div className="rounded-md border">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50 text-xs">
                                        <th className="px-3 py-2 text-left font-medium">Country</th>
                                        <th className="px-3 py-2 text-right font-medium">Revenue</th>
                                        <th className="px-3 py-2 text-right font-medium">Orders</th>
                                        <th className="px-3 py-2 text-right font-medium">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, maxCountries).map((country, i) => (
                                        <tr key={country.country} className="border-b last:border-0">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2 w-2 rounded-full"
                                                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                                    />
                                                    <span className="text-sm">{country.countryName || country.country}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm font-medium">
                                                {formatCurrency(country.revenue, currency)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm">
                                                {formatNumber(country.orders)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                                                {country.percentage.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {data.length > maxCountries && (
                                    <tfoot>
                                        <tr className="border-t bg-muted/30">
                                            <td className="px-3 py-2 text-sm font-medium">Other ({data.length - maxCountries} countries)</td>
                                            <td className="px-3 py-2 text-right text-sm font-medium">
                                                {formatCurrency(
                                                    data.slice(maxCountries).reduce((sum, c) => sum + c.revenue, 0),
                                                    currency
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm">
                                                {formatNumber(
                                                    data.slice(maxCountries).reduce((sum, c) => sum + c.orders, 0)
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                                                {(
                                                    (data.slice(maxCountries).reduce((sum, c) => sum + c.revenue, 0) /
                                                        totalRevenue) *
                                                    100
                                                ).toFixed(1)}
                                                %
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </TabsContent>

                    <TabsContent value="chart">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(1)}%)`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatCurrency(Number(value), currency)}
                                        contentStyle={{
                                            backgroundColor: "var(--background)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "6px",
                                        }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Summary bar */}
                <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            {data.length} country{data.length !== 1 ? "s" : ""}
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
