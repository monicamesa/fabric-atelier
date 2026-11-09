import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Placeholder block with the shape of the content being loaded. */
export function Skeleton({ className }: { className?: string }) {
    return <span aria-hidden="true" className={cn("block animate-pulse bg-track", className)} />;
}

/** Live loading message; pair it with skeletons. */
export function LoadingLine({ children }: { children: ReactNode }) {
    return (
        <p role="status" className="m-0 font-mono text-[14px] text-text-muted">
            {children}
        </p>
    );
}

interface EmptyStateProps {
    message: string;
    action?: ReactNode;
    className?: string;
}

/** Short explanation plus the one action that fills the space. */
export function EmptyState({ message, action, className }: EmptyStateProps) {
    return (
        <div className={cn("flex flex-col items-start gap-3 border border-dashed border-text-muted p-5", className)}>
            <p className="m-0 text-[15px] text-text">{message}</p>
            {action}
        </div>
    );
}
