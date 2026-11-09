import { cn } from "@/lib/utils";

/** Votes for an answer against the threshold that settles the case. The text next to it carries the numbers. */
export function VoteBar({ value, max, tone = "ink", className }: { value: number; max: number; tone?: "ink" | "review"; className?: string }) {
    const percent = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
    return (
        <span aria-hidden="true" className={cn("block h-1.5 w-full bg-track", className)}>
            <span className={cn("block h-full", tone === "ink" ? "bg-ink" : "bg-review")} style={{ width: `${percent}%` }} />
        </span>
    );
}
