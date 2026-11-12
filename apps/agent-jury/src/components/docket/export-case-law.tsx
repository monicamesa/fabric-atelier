import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { buildCaseLaw, caseLawFilename, toCaseLawCsv } from "@/data/case-law-csv";
import type { Docket } from "@/data/docket";
import { downloadTextFile } from "@/lib/download";
import { cn } from "@/lib/utils";

interface ExportCaseLawProps {
    agentName: string;
    docket: Docket | undefined;
    className?: string;
}

/**
 * "Export case law": the agent's ruled cases as a Quality Lab CSV, built here from data already loaded. Disabled, with the
 * reason as a tooltip, when there is nothing to export or when reopened cases can't be ruled out.
 */
export function ExportCaseLaw({ agentName, docket, className }: ExportCaseLawProps) {
    const { t } = useTranslation();
    const [exported, setExported] = useState<number>();
    const rows = docket ? buildCaseLaw(docket.cases) : [];
    const unavailable = docket?.reviewsAvailable === false;
    const reason = !docket ? t("caseLaw.loading") : unavailable ? t("caseLaw.reviewsUnavailable") : rows.length === 0 ? t("caseLaw.empty") : undefined;

    function run() {
        if (reason) return;
        downloadTextFile(caseLawFilename(agentName, new Date()), toCaseLawCsv(rows));
        setExported(rows.length);
    }

    // aria-disabled (not disabled) keeps the button focusable and its tooltip reachable.
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <button
                type="button"
                aria-disabled={reason ? true : undefined}
                aria-describedby={reason ? "case-law-reason" : undefined}
                title={reason ?? t("caseLaw.help", { count: rows.length })}
                onClick={run}
                className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 border-2 border-ink bg-transparent px-4 text-[15px] font-bold text-ink",
                    reason ? "cursor-not-allowed opacity-60" : "hover:bg-paper-hover",
                )}
            >
                <Download aria-hidden="true" className="size-4" />
                {t("caseLaw.export")}
            </button>
            {reason && (
                <span id="case-law-reason" className="sr-only">
                    {reason}
                </span>
            )}
            {exported !== undefined && !reason && (
                <p role="status" className="m-0 text-[13px] text-text-muted">
                    {t("caseLaw.done", { count: exported })}
                </p>
            )}
        </div>
    );
}
