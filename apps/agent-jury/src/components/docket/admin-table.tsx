import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AdminColumn {
    key: string;
    header: string;
    /** Header read by screen readers only (e.g. "Actions"). */
    hiddenHeader?: boolean;
    align?: "left" | "right";
}

interface AdminTableProps {
    caption: string;
    columns: AdminColumn[];
    children: ReactNode;
}

/** Raised table with an ink border and uppercase headers (design guide, "Admin table"). */
export function AdminTable({ caption, columns, children }: AdminTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-ink bg-paper-raised text-[15px] text-text">
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr className="text-[12px] uppercase tracking-[0.1em] text-ink">
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                scope="col"
                                className={cn("px-3.5 py-3 font-bold", column.align === "right" ? "text-right" : "text-left")}
                            >
                                {column.hiddenHeader ? <span className="sr-only">{column.header}</span> : column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

export function AdminRow({ children }: { children: ReactNode }) {
    return <tr className="border-t border-rule align-middle hover:bg-paper-hover">{children}</tr>;
}

export function AdminCell({ children, align = "left", className }: { children: ReactNode; align?: "left" | "right"; className?: string }) {
    return <td className={cn("px-3.5 py-3", align === "right" && "text-right", className)}>{children}</td>;
}
