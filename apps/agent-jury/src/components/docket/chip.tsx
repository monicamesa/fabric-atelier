import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { JurorRole } from "@/rules/case-validity";
import { cn } from "@/lib/utils";

export type ChipTone = "ink" | "ruled" | "review" | "action" | "muted";

const OUTLINED: Record<ChipTone, string> = {
    ink: "border-ink text-ink",
    ruled: "border-ruled text-ruled",
    review: "border-review text-review-text",
    action: "border-action text-action-text",
    muted: "border-dashed border-text-muted text-text-muted",
};

// Fills keep light text in both themes: --ink-inverse is light in light mode, --ink is light in dark mode.
const FILLED: Record<ChipTone, string> = {
    ink: "border-ink bg-ink text-ink-inverse",
    ruled: "border-ruled-fill bg-ruled-fill text-ink-inverse dark:text-ink",
    review: "border-review bg-review text-ink-inverse",
    action: "border-action bg-action text-ink-inverse dark:text-ink",
    muted: "border-text-muted bg-text-muted text-ink-inverse",
};

interface ChipProps {
    tone?: ChipTone;
    filled?: boolean;
    children: ReactNode;
    className?: string;
}

/** Uppercase label with a 2 px border (open states) or filled (settled states). Never colour alone. */
export function Chip({ tone = "ink", filled = false, children, className }: ChipProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center whitespace-nowrap border-2 px-2 py-0.5 text-[12px] font-bold uppercase leading-5 tracking-[0.1em]",
                filled ? FILLED[tone] : OUTLINED[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

/** ADMIN is filled ink; EXPERT and APPROVER are outlined. */
export function RoleChip({ role }: { role: JurorRole }) {
    const { t } = useTranslation();
    return (
        <Chip tone="ink" filled={role === "admin"}>
            {t(`roles.${role}.label`)}
        </Chip>
    );
}
