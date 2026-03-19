"use client";

import { useState, useEffect } from "react";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, DollarSign } from "lucide-react";
import { getCountryCoordinates } from "@/lib/countries";

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

export function WorldMap() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const { enabledAccountIds } = useDashboardData();

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
            params.set("limit", "100"); // Get more sales for map visualization
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

    // Group sales by country
    const salesByCountry = sales.reduce((acc, sale) => {
        if (!sale.country) return acc;

        const countryKey = sale.country.toUpperCase();
        if (!acc[countryKey]) {
            acc[countryKey] = {
                country: countryKey,
                countryName: sale.countryName || countryKey,
                sales: [],
            };
        }
        acc[countryKey].sales.push(sale);
        return acc;
    }, {} as Record<string, { country: string; countryName: string; sales: Sale[] }>);

    // Calculate total sales per country
    const countrySalesTotals = Object.values(salesByCountry).map((entry) => ({
        ...entry,
        totalAmount: entry.sales.reduce((sum, sale) => sum + sale.amount, 0),
        count: entry.sales.length,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Find coordinates for each country
    const countriesWithCoordinates = countrySalesTotals.map((entry) => {
        const coords = getCountryCoordinates(entry.country);
        return {
            ...entry,
            coordinates: coords,
        };
    }).filter(entry => entry.coordinates); // Filter out countries with no coordinates

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        World Map
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        Loading map...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (countriesWithCoordinates.length === 0) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        World Map
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No sales data available
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    World Map
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] relative overflow-hidden rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    {/* Simple map visualization - in production, use a proper mapping library */}
                    <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/World_map_blank_without_borders.svg/1024px-World_map_blank_without_borders.svg.png')] bg-cover bg-center opacity-20" />

                    {/* Sales pins */}
                    {countriesWithCoordinates.map((entry) => (
                        <div
                            key={entry.country}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                            style={{
                                left: `${(entry.coordinates!.lng + 180) / 360 * 100}%`,
                                top: `${(90 - entry.coordinates!.lat) / 180 * 100}%`,
                            }}
                        >
                            {/* Pin */}
                            <div className="w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-emerald-200 dark:ring-emerald-800 animate-pulse" />

                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-slate-200 dark:border-slate-700">
                                <div className="font-medium text-sm">{entry.countryName}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <DollarSign className="w-3 h-3" />
                                    <span>{formatCurrency(entry.totalAmount, entry.sales[0].currency)}</span>
                                    <span className="mx-1">•</span>
                                    <span>{entry.count} sales</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
                    {countriesWithCoordinates.slice(0, 3).map((entry) => (
                        <div key={entry.country} className="flex items-center gap-2 text-sm">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                            <div className="flex-1">{entry.countryName}</div>
                            <div className="font-medium">{formatCurrency(entry.totalAmount, entry.sales[0].currency)}</div>
                        </div>
                    ))}
                    {countriesWithCoordinates.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                            +{countriesWithCoordinates.length - 3} more countries
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
