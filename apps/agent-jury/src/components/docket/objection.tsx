import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ObjectionProps {
    message: string;
    /** Calming line, e.g. "Nothing was changed." */
    reassurance?: string;
    technicalDetails?: string;
    onRetry?: () => void;
    compact?: boolean;
    className?: string;
}

/** Error block (design guide, section 6): "Objection!", what happened, and collapsible technical details. */
export function Objection({ message, reassurance, technicalDetails, onRetry, compact = false, className }: ObjectionProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    async function copyDetails() {
        if (!technicalDetails) return;
        try {
            await navigator.clipboard.writeText(technicalDetails);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div
            role="alert"
            className={cn("flex flex-col gap-2 border-2 border-action bg-dispute-bg text-dispute-text", compact ? "p-3" : "p-5", className)}
        >
            <p className={cn("m-0 font-serif font-black text-dispute-text", compact ? "text-[20px]" : "text-[28px]")}>
                {t("states.objection")}
            </p>
            <p className="m-0 text-[15px] font-semibold">{message}</p>
            {reassurance && <p className="m-0 text-[14px]">{reassurance}</p>}
            {(onRetry || technicalDetails) && (
                <div className="flex flex-wrap items-center gap-3">
                    {onRetry && (
                        <Button variant="secondary" compact onClick={onRetry} className="border-dispute-text text-dispute-text">
                            {t("common.retry")}
                        </Button>
                    )}
                    {technicalDetails && !compact && (
                        <Button variant="link" compact onClick={() => void copyDetails()} className="text-dispute-text">
                            {copied ? t("states.copied") : t("states.copyDetails")}
                        </Button>
                    )}
                </div>
            )}
            {technicalDetails && (
                <details className="text-[13px]">
                    <summary className="min-h-9 cursor-pointer py-1 font-semibold">{t("states.technicalDetails")}</summary>
                    <code className="block whitespace-pre-wrap break-words font-mono text-[13px]">{technicalDetails}</code>
                </details>
            )}
        </div>
    );
}
