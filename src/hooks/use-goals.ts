"use client";

import { useState, useEffect, useCallback } from "react";

export interface Goal {
    id: string;
    name: string;
    targetValue: number;
    currentValue: number;
    metricType: string;
    period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
    startDate: string;
    endDate: string;
    alertThreshold: number;
    alertEnabled: boolean;
    isActive: boolean;
    notifyOnAchieve: boolean;
    createdAt: string;
    updatedAt: string;
}

interface UseGoalsResult {
    goals: Goal[];
    loading: boolean;
    error: string | null;
    syncing: boolean;
    addGoal: (goal: Omit<Goal, "id" | "createdAt" | "updatedAt" | "currentValue">) => Promise<void>;
    updateGoal: (id: string, updates: Partial<Goal>) => Promise<Goal | null>;
    deleteGoal: (id: string) => Promise<void>;
    updateGoalProgress: (id: string, currentValue: number) => Promise<void>;
    syncGoals: () => Promise<void>;
    getGoalsByMetric: (metricType: string) => Goal[];
    getActiveGoals: () => Goal[];
    getGoalsNeedingAlert: () => Goal[];
    refetch: () => void;
}

export function useGoals(): UseGoalsResult {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    const fetchGoals = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch("/api/goals");
            if (!response.ok) {
                throw new Error("Failed to fetch goals");
            }
            const data = await response.json();
            setGoals(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    const addGoal = useCallback(
        async (goal: Omit<Goal, "id" | "createdAt" | "updatedAt" | "currentValue">) => {
            const response = await fetch("/api/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(goal),
            });
            if (!response.ok) {
                throw new Error("Failed to create goal");
            }
            const newGoal = await response.json();
            setGoals((prev) => [...prev, newGoal]);
        },
        []
    );

    const updateGoal = useCallback(
        async (id: string, updates: Partial<Goal>): Promise<Goal | null> => {
            const response = await fetch("/api/goals", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates }),
            });
            if (!response.ok) {
                throw new Error("Failed to update goal");
            }
            const updatedGoal = await response.json();
            setGoals((prev) =>
                prev.map((g) => (g.id === id ? updatedGoal : g))
            );
            return updatedGoal;
        },
        []
    );

    const deleteGoal = useCallback(async (id: string) => {
        const response = await fetch(`/api/goals?id=${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            throw new Error("Failed to delete goal");
        }
        setGoals((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            return safePrev.filter((g) => g.id !== id);
        });
    }, []);

    const updateGoalProgress = useCallback(
        async (id: string, currentValue: number) => {
            await updateGoal(id, { currentValue });
        },
        [updateGoal]
    );

    const getGoalsByMetric = useCallback(
        (metricType: string) => {
            const safeGoals = Array.isArray(goals) ? goals : [];
            return safeGoals.filter((g) => g.metricType === metricType);
        },
        [goals]
    );

    const getActiveGoals = useCallback(() => {
        const safeGoals = Array.isArray(goals) ? goals : [];
        return safeGoals.filter((g) => g.isActive);
    }, [goals]);

    const getGoalsNeedingAlert = useCallback(() => {
        const safeGoals = Array.isArray(goals) ? goals : [];
        return safeGoals.filter((g) => {
            if (!g.alertEnabled || !g.isActive) return false;
            const percentComplete = (g.currentValue / g.targetValue) * 100;
            return percentComplete >= g.alertThreshold;
        });
    }, [goals]);

    const syncGoals = useCallback(async () => {
        try {
            setSyncing(true);
            const response = await fetch("/api/goals/sync", { method: "POST" });
            if (!response.ok) {
                throw new Error("Failed to sync goals");
            }
            // Refetch goals after sync to get updated values
            await fetchGoals();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setSyncing(false);
        }
    }, [fetchGoals]);

    return {
        goals,
        loading,
        error,
        syncing,
        addGoal,
        updateGoal,
        deleteGoal,
        updateGoalProgress,
        syncGoals,
        getGoalsByMetric,
        getActiveGoals,
        getGoalsNeedingAlert,
        refetch: fetchGoals,
    };
}
