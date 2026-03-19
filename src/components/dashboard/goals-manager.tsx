"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals, type Goal } from "@/hooks/use-goals";
import { formatCurrency } from "@/lib/format";
import {
    Plus,
    Pencil,
    Trash2,
    Target,
    TrendingUp,
    Bell,
    BellOff,
    CheckCircle2,
    AlertCircle,
    Trophy,
    Calendar,
    X,
    RefreshCw,
} from "lucide-react";

interface GoalsManagerProps {
    currentRevenue?: number;
    currentMrr?: number;
    currentSalesCount?: number;
    currentCustomers?: number;
    currency?: string;
    onGoalUpdate?: () => void;
}

const METRIC_OPTIONS = [
    { value: "revenue", label: "Revenue", icon: TrendingUp },
    { value: "mrr", label: "MRR", icon: TrendingUp },
    { value: "sales_count", label: "Sales Count", icon: Target },
    { value: "new_customers", label: "New Customers", icon: Target },
];

const PERIOD_OPTIONS = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
];

export function GoalsManager({
    currentRevenue = 0,
    currentMrr = 0,
    currentSalesCount = 0,
    currentCustomers = 0,
    currency = "USD",
    onGoalUpdate,
}: GoalsManagerProps) {
    const { goals, loading, syncing, addGoal, updateGoal, deleteGoal, syncGoals, getActiveGoals } = useGoals();
    const [isOpen, setIsOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
    const [showNotifications, setShowNotifications] = useState(true);
    const [recentAlerts, setRecentAlerts] = useState<Goal[]>([]);

    const [formData, setFormData] = useState({
        name: "",
        targetValue: "",
        metricType: "revenue",
        period: "monthly",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        alertThreshold: "80",
        alertEnabled: true,
        isActive: true,
        notifyOnAchieve: true,
    });

    // Set default end date based on period
    useEffect(() => {
        if (!formData.endDate) {
            const start = new Date(formData.startDate);
            const end = new Date(start);
            switch (formData.period) {
                case "daily":
                    end.setDate(end.getDate() + 1);
                    break;
                case "weekly":
                    end.setDate(end.getDate() + 7);
                    break;
                case "monthly":
                    end.setMonth(end.getMonth() + 1);
                    break;
                case "quarterly":
                    end.setMonth(end.getMonth() + 3);
                    break;
                case "yearly":
                    end.setFullYear(end.getFullYear() + 1);
                    break;
            }
            setFormData((prev) => ({
                ...prev,
                endDate: end.toISOString().split("T")[0],
            }));
        }
    }, [formData.period, formData.startDate]);

    // Check for alerts
    useEffect(() => {
        const activeGoals = getActiveGoals();
        const alerts = activeGoals.filter((goal) => {
            const percentComplete = (goal.currentValue / goal.targetValue) * 100;
            return percentComplete >= goal.alertThreshold;
        });
        if (showNotifications && alerts.length > 0) {
            setRecentAlerts(alerts);
        } else {
            setRecentAlerts([]);
        }
    }, [goals, showNotifications, getActiveGoals]);

    const resetForm = () => {
        const now = new Date();
        const end = new Date();
        end.setMonth(end.getMonth() + 1);

        setFormData({
            name: "",
            targetValue: "",
            metricType: "revenue",
            period: "monthly",
            startDate: now.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            alertThreshold: "80",
            alertEnabled: true,
            isActive: true,
            notifyOnAchieve: true,
        });
        setEditingGoal(null);
    };

    const handleOpenDialog = (goal?: Goal) => {
        if (goal) {
            setEditingGoal(goal);
            setFormData({
                name: goal.name,
                targetValue: goal.targetValue.toString(),
                metricType: goal.metricType,
                period: goal.period,
                startDate: goal.startDate,
                endDate: goal.endDate,
                alertThreshold: goal.alertThreshold.toString(),
                alertEnabled: goal.alertEnabled,
                isActive: goal.isActive,
                notifyOnAchieve: goal.notifyOnAchieve,
            });
        } else {
            resetForm();
        }
        setIsOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const goalData = {
                name: formData.name,
                targetValue: parseFloat(formData.targetValue) || 0,
                metricType: formData.metricType,
                period: formData.period as Goal["period"],
                startDate: formData.startDate,
                endDate: formData.endDate,
                alertThreshold: parseFloat(formData.alertThreshold) || 80,
                alertEnabled: formData.alertEnabled,
                isActive: formData.isActive,
                notifyOnAchieve: formData.notifyOnAchieve,
            };

            if (editingGoal) {
                await updateGoal(editingGoal.id, goalData);
            } else {
                await addGoal(goalData);
            }
            setIsOpen(false);
            resetForm();
            onGoalUpdate?.();
        } catch (error) {
            console.error("Error saving goal:", error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteGoal(id);
            onGoalUpdate?.();
        } catch (error) {
            console.error("Error deleting goal:", error);
        }
    };

    const toggleGoalActive = async (goal: Goal) => {
        try {
            await updateGoal(goal.id, { isActive: !goal.isActive });
            onGoalUpdate?.();
        } catch (error) {
            console.error("Error toggling goal:", error);
        }
    };

    const getCurrentMetricValue = (metricType: string): number => {
        switch (metricType) {
            case "revenue":
                return currentRevenue;
            case "mrr":
                return currentMrr;
            case "sales_count":
                return currentSalesCount;
            case "new_customers":
                return currentCustomers;
            default:
                return 0;
        }
    };

    const activeGoals = getActiveGoals();

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Goals & Targets
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(2)].map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            {/* Notification Toast */}
            {showNotifications && recentAlerts.length > 0 && (
                <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
                    {recentAlerts.map((goal) => {
                        const percent = Math.min(
                            100,
                            Math.round((goal.currentValue / goal.targetValue) * 100)
                        );
                        const achieved = percent >= 100;
                        return (
                            <div
                                key={goal.id}
                                className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border ${achieved
                                    ? "bg-green-500/10 border-green-500/30"
                                    : "bg-amber-500/10 border-amber-500/30"
                                    }`}
                            >
                                {achieved ? (
                                    <Trophy className="h-5 w-5 text-green-500 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">
                                        {achieved ? "Goal Achieved!" : "Goal Alert"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {goal.name}: {percent}% complete
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setShowNotifications(false)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="h-5 w-5" />
                        Goals & Targets
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => syncGoals()}
                            disabled={syncing}
                            title="Sync progress from actual metrics"
                        >
                            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                        </Button>
                        {recentAlerts.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowNotifications(!showNotifications)}
                            >
                                {showNotifications ? (
                                    <Bell className="h-4 w-4" />
                                ) : (
                                    <BellOff className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                        <Dialog open={isOpen} onOpenChange={setIsOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Goal
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingGoal ? "Edit Goal" : "Set New Goal"}
                                    </DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <Label htmlFor="name">Goal Name</Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData({ ...formData, name: e.target.value })
                                            }
                                            placeholder="e.g., Monthly Revenue Target"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="metricType">Metric</Label>
                                            <select
                                                id="metricType"
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                value={formData.metricType}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, metricType: e.target.value })
                                                }
                                            >
                                                {METRIC_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <Label htmlFor="period">Period</Label>
                                            <select
                                                id="period"
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                                value={formData.period}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, period: e.target.value })
                                                }
                                            >
                                                {PERIOD_OPTIONS.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="targetValue">Target Value</Label>
                                        <Input
                                            id="targetValue"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.targetValue}
                                            onChange={(e) =>
                                                setFormData({ ...formData, targetValue: e.target.value })
                                            }
                                            placeholder={
                                                formData.metricType === "revenue" ||
                                                    formData.metricType === "mrr"
                                                    ? "10000"
                                                    : "100"
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="startDate">Start Date</Label>
                                            <Input
                                                id="startDate"
                                                type="date"
                                                value={formData.startDate}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, startDate: e.target.value })
                                                }
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="endDate">End Date</Label>
                                            <Input
                                                id="endDate"
                                                type="date"
                                                value={formData.endDate}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, endDate: e.target.value })
                                                }
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="alertThreshold">Alert at %</Label>
                                        <Input
                                            id="alertThreshold"
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={formData.alertThreshold}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    alertThreshold: e.target.value,
                                                })
                                            }
                                            placeholder="80"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Notify when goal reaches this percentage
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={formData.alertEnabled}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        alertEnabled: e.target.checked,
                                                    })
                                                }
                                                className="rounded border-input"
                                            />
                                            Enable alerts
                                        </label>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={formData.isActive}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        isActive: e.target.checked,
                                                    })
                                                }
                                                className="rounded border-input"
                                            />
                                            Active
                                        </label>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button type="submit">
                                            {editingGoal ? "Update" : "Create"} Goal
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {activeGoals.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No goals set yet.</p>
                            <p className="text-xs mt-1">
                                Set revenue targets to track your progress.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {activeGoals.map((goal) => {
                                const currentValue = getCurrentMetricValue(goal.metricType);
                                const percent = Math.min(
                                    100,
                                    Math.round((currentValue / goal.targetValue) * 100)
                                );
                                const achieved = percent >= 100;
                                const alertTriggered =
                                    percent >= goal.alertThreshold && !achieved;

                                return (
                                    <div
                                        key={goal.id}
                                        className={`p-4 rounded-lg border ${achieved
                                            ? "bg-green-500/5 border-green-500/20"
                                            : alertTriggered
                                                ? "bg-amber-500/5 border-amber-500/20"
                                                : "bg-card"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {achieved ? (
                                                    <Trophy className="h-4 w-4 text-green-500" />
                                                ) : alertTriggered ? (
                                                    <AlertCircle className="h-4 w-4 text-amber-500" />
                                                ) : (
                                                    <Target className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <span className="font-medium">{goal.name}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleOpenDialog(goal)}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => handleDelete(goal.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mb-2">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                                <span>
                                                    {formatCurrency(currentValue, currency)} /{" "}
                                                    {formatCurrency(goal.targetValue, currency)}
                                                </span>
                                                <span className={achieved ? "text-green-500 font-medium" : ""}>
                                                    {percent}%
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${achieved
                                                        ? "bg-green-500"
                                                        : alertTriggered
                                                            ? "bg-amber-500"
                                                            : "bg-primary"
                                                        }`}
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {goal.period}
                                            </span>
                                            {goal.alertEnabled && (
                                                <span className="flex items-center gap-1">
                                                    <Bell className="h-3 w-3" />
                                                    Alert at {goal.alertThreshold}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
