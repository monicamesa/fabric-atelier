import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger-text" | "link";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    compact?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
    // One primary per view (design guide, section 5).
    primary:
        "bg-ink text-ink-inverse font-bold shadow-[5px_5px_0_var(--action)] hover:shadow-[3px_3px_0_var(--action)] hover:translate-x-[2px] hover:translate-y-[2px]",
    secondary: "border-2 border-ink bg-transparent text-ink font-bold hover:bg-paper-hover",
    quiet: "border border-ink bg-transparent text-ink font-semibold hover:bg-paper-hover",
    "danger-text": "bg-transparent text-action-text font-bold hover:underline",
    link: "bg-transparent text-action-text font-bold hover:underline px-0",
};

export function Button({ variant = "secondary", compact = false, className, type = "button", ...props }: ButtonProps) {
    const height = variant === "primary" ? (compact ? "min-h-11" : "min-h-[52px]") : compact ? "min-h-9" : "min-h-11";
    return (
        <button
            type={type}
            className={cn(
                "inline-flex items-center justify-center gap-2 px-4 text-[15px] transition-[transform,box-shadow] duration-150",
                "disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-x-0 disabled:translate-y-0",
                height,
                VARIANTS[variant],
                className,
            )}
            {...props}
        />
    );
}
