import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { cn } from "@/lib/utils";
import type { JudgeTrust, TrustCounts, VersionTrust } from "@/rules/judge-trust";
import { isStandardCriteria } from "./judge-criteria";

/** The big number: a percentage once there are enough decided verdicts, "n of m" before that, never an invented value. */
function headline(counts: TrustCounts, t: TFunction): string {
    if (counts.showPercent && counts.percent !== null) return `${counts.percent}%`;
    if (counts.decided > 0) return t("home.trustOf", { agreed: counts.agreed, decided: counts.decided });
    return "—";
}

function Caption({ counts }: { counts: TrustCounts }) {
    const { t } = useTranslation();
    return (
        <>
            {counts.decided > 0 ? t("home.trustCaption", { agreed: counts.agreed, decided: counts.decided }) : t("home.trustPending")}
            {counts.pending > 0 && <span className="text-text-muted"> {t("home.trustPendingCount", { count: counts.pending })}</span>}
        </>
    );
}

function History({ history }: { history: VersionTrust[] }) {
    const { t } = useTranslation();
    if (history.length === 0) return null;
    return (
        <details className="max-w-[320px] text-[14px] text-text">
            <summary className="min-h-9 cursor-pointer py-1 font-semibold text-ink">{t("home.trustHistory")}</summary>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {history.map((item) => (
                    <li key={item.version} className="flex flex-wrap gap-x-2">
                        <span className="font-mono text-[13px] text-ink">{isStandardCriteria(item.version) ? t("home.trustVersionStandard") : item.version}</span>
                        <span>
                            {item.decided > 0 ? t("home.trustOf", { agreed: item.agreed, decided: item.decided }) : "—"}
                            {item.showPercent && item.percent !== null ? ` · ${item.percent}%` : ""}
                        </span>
                    </li>
                ))}
            </ul>
        </details>
    );
}

/** Judge trust for the agent (I3b): the current critic-prompt version prominently, earlier versions as history. */
export function JudgeTrustPanel({ trust, className }: { trust?: JudgeTrust; className?: string }) {
    const { t } = useTranslation();
    const current = trust?.current;
    const standard = current ? isStandardCriteria(current.version) : false;
    return (
        <section aria-labelledby="judge-trust-title" className={cn("flex flex-col gap-3", className)}>
            <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-2">
                <h2 id="judge-trust-title" className="m-0 text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
                    {t("vocabulary.judgeTrust")}
                </h2>
                {current &&
                    (standard ? (
                        <span className="text-[13px] font-semibold text-text-muted">{t("home.trustStandard")}</span>
                    ) : (
                        <span className="font-mono text-[13px] text-text-muted">{t("home.trustPrompt", { version: current.version })}</span>
                    ))}
            </div>
            {current && standard && <p className="m-0 max-w-[340px] text-[13px] leading-snug text-text-muted">{t("home.trustStandardHelp")}</p>}
            <p className="m-0 font-serif text-[48px] font-black leading-none text-ink" data-testid="trust-headline">
                {current ? headline(current, t) : "—"}
            </p>
            <p className="m-0 max-w-[340px] text-[15px] leading-normal text-text">{current ? <Caption counts={current} /> : t("home.trustPending")}</p>
            {trust && <History history={trust.history} />}
        </section>
    );
}

/** Compact version for phones. */
export function JudgeTrustLine({ trust, className }: { trust?: JudgeTrust; className?: string }) {
    const { t } = useTranslation();
    const current = trust?.current;
    return (
        <div className={cn("flex flex-col gap-1 border-t border-rule pt-3 text-[14px] text-text", className)}>
            <p className="m-0">
                <b className="text-[12px] uppercase tracking-[0.14em] text-ink">{t("vocabulary.judgeTrust")}</b>
                {current && <span className="text-[12px] text-text-muted"> · {isStandardCriteria(current.version) ? t("home.trustStandard") : t("home.trustPrompt", { version: current.version })}</span>}
                {" — "}
                {current && current.decided > 0 && <b className="text-ink">{headline(current, t)} </b>}
                {current ? <Caption counts={current} /> : t("home.trustPending")}
            </p>
            {trust && <History history={trust.history} />}
        </div>
    );
}
