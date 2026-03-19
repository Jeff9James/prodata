"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductCogs, type ProductCog } from "@/hooks/use-cogs";
import { formatCurrency } from "@/lib/format";
import { Plus, Pencil, Trash2, DollarSign, Percent, X } from "lucide-react";

interface CogsManagerProps {
    products?: Array<{
        productId: string;
        productName: string;
        platform: string;
        revenue: number;
        currency?: string;
    }>;
    onCogsChange?: () => void;
}

export function CogsManager({ products = [], onCogsChange }: CogsManagerProps) {
    const { cogs, loading, addCog, updateCog, deleteCog } = useProductCogs();
    const [isOpen, setIsOpen] = useState(false);
    const [editingCog, setEditingCog] = useState<ProductCog | null>(null);
    const [formData, setFormData] = useState({
        productId: "",
        platform: "",
        productName: "",
        cogsAmount: "0",
        estimatedFeePercent: "0",
        currency: "USD",
    });

    const resetForm = () => {
        setFormData({
            productId: "",
            platform: "",
            productName: "",
            cogsAmount: "0",
            estimatedFeePercent: "0",
            currency: "USD",
        });
        setEditingCog(null);
    };

    const handleOpenDialog = (cog?: ProductCog) => {
        if (cog) {
            setEditingCog(cog);
            setFormData({
                productId: cog.productId,
                platform: cog.platform,
                productName: cog.productName,
                cogsAmount: cog.cogsAmount.toString(),
                estimatedFeePercent: cog.estimatedFeePercent.toString(),
                currency: cog.currency,
            });
        } else {
            resetForm();
        }
        setIsOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCog) {
                await updateCog(editingCog.id, {
                    cogsAmount: parseFloat(formData.cogsAmount) || 0,
                    estimatedFeePercent: parseFloat(formData.estimatedFeePercent) || 0,
                    currency: formData.currency,
                });
            } else {
                await addCog({
                    productId: formData.productId,
                    platform: formData.platform,
                    productName: formData.productName,
                    cogsAmount: parseFloat(formData.cogsAmount) || 0,
                    estimatedFeePercent: parseFloat(formData.estimatedFeePercent) || 0,
                    currency: formData.currency,
                });
            }
            setIsOpen(false);
            resetForm();
            onCogsChange?.();
        } catch (error) {
            console.error("Error saving COGS:", error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteCog(id);
            onCogsChange?.();
        } catch (error) {
            console.error("Error deleting COGS:", error);
        }
    };

    // Calculate total costs and profit from configured COGS
    const totalConfiguredCogs = cogs.reduce((sum, cog) => {
        // This is the base cost - actual profit calculation needs sales data
        return sum + cog.cogsAmount;
    }, 0);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Product Costs (COGS)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5" />
                    Product Costs (COGS)
                </CardTitle>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleOpenDialog()}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Cost
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {editingCog ? "Edit Product Cost" : "Add Product Cost"}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!editingCog && (
                                <>
                                    <div>
                                        <Label htmlFor="productName">Product Name</Label>
                                        <Input
                                            id="productName"
                                            value={formData.productName}
                                            onChange={(e) =>
                                                setFormData({ ...formData, productName: e.target.value })
                                            }
                                            placeholder="e.g., My Digital Product"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="productId">Product ID</Label>
                                        <Input
                                            id="productId"
                                            value={formData.productId}
                                            onChange={(e) =>
                                                setFormData({ ...formData, productId: e.target.value })
                                            }
                                            placeholder="Platform-specific product ID"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="platform">Platform</Label>
                                        <select
                                            id="platform"
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            value={formData.platform}
                                            onChange={(e) =>
                                                setFormData({ ...formData, platform: e.target.value })
                                            }
                                            required
                                        >
                                            <option value="">Select platform</option>
                                            <option value="stripe">Stripe</option>
                                            <option value="gumroad">Gumroad</option>
                                            <option value="revenuecat">RevenueCat</option>
                                            <option value="amazon">Amazon</option>
                                        </select>
                                    </div>
                                </>
                            )}
                            <div>
                                <Label htmlFor="cogsAmount" className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    Cost per Unit
                                </Label>
                                <Input
                                    id="cogsAmount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.cogsAmount}
                                    onChange={(e) =>
                                        setFormData({ ...formData, cogsAmount: e.target.value })
                                    }
                                    placeholder="0.00"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Your cost to deliver this product (hosting, licenses, etc.)
                                </p>
                            </div>
                            <div>
                                <Label htmlFor="estimatedFeePercent" className="flex items-center gap-1">
                                    <Percent className="h-3 w-3" />
                                    Est. Platform Fee %
                                </Label>
                                <Input
                                    id="estimatedFeePercent"
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={formData.estimatedFeePercent}
                                    onChange={(e) =>
                                        setFormData({ ...formData, estimatedFeePercent: e.target.value })
                                    }
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Platform transaction fee (e.g., 5 for 5%)
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {editingCog ? "Update" : "Add"} Cost
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {cogs.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No product costs configured yet.</p>
                        <p className="text-xs mt-1">
                            Add costs to calculate net profit.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {cogs.map((cog) => (
                            <div
                                key={cog.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{cog.productName}</p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                        <span className="capitalize">{cog.platform}</span>
                                        <span>•</span>
                                        <span>{formatCurrency(cog.cogsAmount, cog.currency)}/unit</span>
                                        <span>•</span>
                                        <span>{cog.estimatedFeePercent}% fee</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleOpenDialog(cog)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive"
                                        onClick={() => handleDelete(cog.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
