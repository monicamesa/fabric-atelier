import { useTranslation } from "react-i18next";
import { Gavel } from "./gavel";

/** Judge trust needs hearings and appeals (I3–I4). Until then it says so instead of showing a number. */
export function JudgeTrustPlaceholder() {
    const { t } = useTranslation();
    return (
        <aside aria-labelledby="judge-trust-title" className="flex flex-col gap-2 border-l border-ink pl-7">
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
