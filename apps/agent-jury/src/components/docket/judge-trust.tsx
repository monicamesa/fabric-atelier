import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Gavel } from "./gavel";

/** Judge trust needs hearings and appeals (I3–I4). Until then it says so instead of showing a number. */
export function JudgeTrustPlaceholder({ className }: { className?: string }) {
    const { t } = useTranslation();
    return (
        <aside aria-labelledby="judge-trust-title" className={cn("flex flex-col gap-2 border-l border-ink pl-7", className)}>
            <Gavel className="size-16" />
            <h2 id="judge-trust-title" className="m-0 text-[13px] font-bold uppercase tracking-[0.14em] text-ink">
                {t("vocabulary.judgeTrust")}
            </h2>
            <p className="m-0 font-serif text-[64px] font-black leading-none text-ink" aria-hidden="true">
                —
            </p>
            <p className="m-0 max-w-[320px] text-[15px] leading-normal text-text">{t("home.trustPending")}</p>
        </aside>
    );
}

/** Compact version for phones while there is no number to show. */
export function JudgeTrustLine({ className }: { className?: string }) {
    const { t } = useTranslation();
    return (
        <p className={cn("m-0 border-t border-rule pt-3 text-[14px] text-text", className)}>
            <b className="text-[12px] uppercase tracking-[0.14em] text-ink">{t("vocabulary.judgeTrust")}</b> — {t("home.trustPending")}
        </p>
    );
}
