"use client";

import { useState, useEffect, useCallback } from "react";

export interface ProductCog {
    id: string;
    productId: string;
    platform: string;
    productName: string;
    cogsAmount: number;
    estimatedFeePercent: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
}

interface UseProductCogsResult {
    cogs: ProductCog[];
    loading: boolean;
    error: string | null;
    addCog: (cog: Omit<ProductCog, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    updateCog: (id: string, updates: Partial<ProductCog>) => Promise<void>;
    deleteCog: (id: string) => Promise<void>;
    getCogByProduct: (platform: string, productId: string) => ProductCog | undefined;
    refetch: () => void;
}

export function useProductCogs(): UseProductCogsResult {
    const [cogs, setCogs] = useState<ProductCog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch("/api/product-cogs");
            if (!response.ok) {
                throw new Error("Failed to fetch COGS data");
            }
            const data = await response.json();
            setCogs(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCogs();
    }, [fetchCogs]);

    const addCog = useCallback(
        async (cog: Omit<ProductCog, "id" | "createdAt" | "updatedAt">) => {
            const response = await fetch("/api/product-cogs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cog),
            });
            if (!response.ok) {
                throw new Error("Failed to add COGS entry");
            }
            const newCog = await response.json();
            setCogs((prev) => {
                const existing = prev.findIndex(
                    (c) => c.platform === cog.platform && c.productId === cog.productId
                );
                if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = newCog;
                    return updated;
                }
                return [...prev, newCog];
            });
        },
        []
    );

    const updateCog = useCallback(
        async (id: string, updates: Partial<ProductCog>) => {
            const response = await fetch("/api/product-cogs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates }),
            });
            if (!response.ok) {
                throw new Error("Failed to update COGS entry");
            }
            const updatedCog = await response.json();
            setCogs((prev) =>
                prev.map((c) => (c.id === id ? updatedCog : c))
            );
        },
        []
    );

    const deleteCog = useCallback(async (id: string) => {
        const response = await fetch(`/api/product-cogs?id=${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error("Failed to delete COGS entry");
        }
        setCogs((prev) => prev.filter((c) => c.id !== id));
    }, []);

    const getCogByProduct = useCallback(
        (platform: string, productId: string) => {
            return cogs.find(
                (c) => c.platform === platform && c.productId === productId
            );
        },
        [cogs]
    );

    return {
        cogs,
        loading,
        error,
        addCog,
        updateCog,
        deleteCog,
        getCogByProduct,
        refetch: fetchCogs,
    };
}
