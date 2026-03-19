import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    text?: string;
}

const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
};

export function LoadingSpinner({
    size = "md",
    className,
    text,
}: LoadingSpinnerProps) {
    return (
        <div className={cn("flex items-center justify-center gap-2", className)}>
            <Loader2 className={cn("animate-spin", sizeClasses[size])} />
            {text && <span className="text-sm text-muted-foreground">{text}</span>}
        </div>
    );
}

interface LoadingOverlayProps {
    show: boolean;
    text?: string;
}

export function LoadingOverlay({ show, text }: LoadingOverlayProps) {
    if (!show) return null;

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50 rounded-lg">
            <LoadingSpinner size="lg" text={text} />
        </div>
    );
}

interface LoadingCardProps {
    className?: string;
    lines?: number;
}

export function LoadingCard({ className, lines = 3 }: LoadingCardProps) {
    return (
        <div className={cn("space-y-3", className)}>
            {[...Array(lines)].map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        "h-4 bg-muted rounded animate-pulse-gentle",
                        i === 0 ? "w-3/4" : i === lines - 1 ? "w-1/2" : "w-full"
                    )}
                    style={{ animationDelay: `${i * 75}ms` }}
                />
            ))}
        </div>
    );
}
