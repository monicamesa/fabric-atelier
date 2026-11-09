import { useTranslation } from "react-i18next";
import { AdminCell, AdminRow, AdminTable } from "@/components/docket/admin-table";
import { Button } from "@/components/docket/button";
import { Chip } from "@/components/docket/chip";
import { Objection } from "@/components/docket/objection";
import { EmptyState, LoadingLine, Skeleton } from "@/components/docket/states";
import { isAppLanguage } from "@/i18n/language-preference";
import { formatDateTime, formatLogDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LogLine } from "./log-entry";
import { visibleLogLines } from "./log-entry";

interface LogState {
    status: "loading" | "success" | "error";
    lines?: LogLine[];
    technicalDetails?: string;
    reload: () => void;
    showChecks: boolean;
    onShowChecksChange: (show: boolean) => void;
}

function ChecksToggle({ log }: { log: LogState }) {
    const { t } = useTranslation();
    return (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start text-[14px] text-text">
            <input
                type="checkbox"
                checked={log.showChecks}
                onChange={(event) => log.onShowChecksChange(event.target.checked)}
                className="size-4 accent-[var(--ink)]"
            />
            {t("clerk.log.showChecks")}
        </label>
    );
}

function useLanguage() {
    const { i18n } = useTranslation();
    return isAppLanguage(i18n.language) ? i18n.language : "en";
}

function LogFailure({ log }: { log: LogState }) {
    const { t } = useTranslation();
    return <Objection compact message={t("clerk.log.loadError")} technicalDetails={log.technicalDetails} onRetry={log.reload} />;
}

/** The last three admin changes, rejected attempts included. */
export function LatestChanges({ log, onOpenLog }: { log: LogState; onOpenLog: () => void }) {
    const { t } = useTranslation();
    const language = useLanguage();
    const lines = log.lines && visibleLogLines(log.lines, log.showChecks).slice(0, 3);

    return (
        <section aria-labelledby="clerk-latest-title" className="flex flex-col gap-2">
            <h2 id="clerk-latest-title" className="m-0 border-b border-ink pb-2 font-serif text-[22px] font-bold text-ink">
                {t("clerk.latest.title")}
            </h2>
            {log.status === "error" && !lines ? (
                <LogFailure log={log} />
            ) : !lines ? (
                <div className="flex flex-col gap-2 py-2">
                    <LoadingLine>{t("clerk.loading")}</LoadingLine>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                </div>
            ) : lines.length === 0 ? (
                <p className="m-0 py-2 text-[14px] text-text-muted">
                    {t(log.lines?.length ? "clerk.log.onlyChecks" : "clerk.latest.empty")}
                </p>
            ) : (
                <ol className="m-0 list-none p-0">
                    {lines.map((line, index) => {
                        const day = formatLogDay(line.processedAt, language);
                        return (
                            <li
                                key={line.id}
                                className={cn(
                                    "grid grid-cols-[76px_minmax(0,1fr)] gap-2.5 py-2.5 text-[14px]",
                                    index < lines.length - 1 && "border-b border-rule",
                                    line.rejected ? "text-action-text" : "text-text",
                                )}
                            >
                                <time dateTime={line.processedAt} className="font-mono text-[12px] text-current opacity-90">
                                    {day.today ? t("clerk.log.today") : day.text}
                                </time>
                                <span>{line.text}</span>
                            </li>
                        );
                    })}
                </ol>
            )}
            <ChecksToggle log={log} />
            <Button variant="link" compact className="self-start text-ruled" onClick={onOpenLog}>
                {t("clerk.latest.openLog")}
            </Button>
        </section>
    );
}

/** Full, read-only admin log. */
export function AdminLogPanel({ log }: { log: LogState }) {
    const { t } = useTranslation();
    const language = useLanguage();
    const lines = log.lines && visibleLogLines(log.lines, log.showChecks);

    return (
        <section aria-labelledby="clerk-log-title" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 id="clerk-log-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                    {t("clerk.log.title")}
                </h2>
                <p className="m-0 text-[15px] text-text-muted">{t("clerk.log.help")}</p>
                <ChecksToggle log={log} />
            </div>
            {log.status === "error" && !lines ? (
                <LogFailure log={log} />
            ) : !lines ? (
                <div className="flex flex-col gap-2">
                    <LoadingLine>{t("clerk.loading")}</LoadingLine>
                    {[0, 1, 2, 3].map((row) => (
                        <Skeleton key={row} className="h-11 w-full" />
                    ))}
                </div>
            ) : lines.length === 0 ? (
                <EmptyState message={t(log.lines?.length ? "clerk.log.onlyChecks" : "clerk.latest.empty")} />
            ) : (
                <AdminTable
                    caption={t("clerk.log.caption")}
                    columns={[
                        { key: "when", header: t("clerk.log.columns.when") },
                        { key: "what", header: t("clerk.log.columns.what") },
                        { key: "result", header: t("clerk.log.columns.result"), align: "right" },
                    ]}
                >
                    {lines.map((line) => (
                        <AdminRow key={line.id}>
                            <AdminCell className="whitespace-nowrap font-mono text-[13px] text-text-muted">
                                <time dateTime={line.processedAt}>{formatDateTime(line.processedAt, language)}</time>
                            </AdminCell>
                            <AdminCell className={line.rejected ? "text-action-text" : undefined}>{line.text}</AdminCell>
                            <AdminCell align="right">
                                <Chip tone={line.rejected ? "action" : "ruled"} filled={!line.rejected}>
                                    {t(line.rejected ? "clerk.log.rejected" : "clerk.log.done")}
                                </Chip>
                            </AdminCell>
                        </AdminRow>
                    ))}
                </AdminTable>
            )}
        </section>
    );
}

export type { LogState };
