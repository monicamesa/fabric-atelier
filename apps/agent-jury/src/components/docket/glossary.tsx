import { useTranslation } from "react-i18next";

const TERMS = ["case", "ruling", "hearing", "appeal"] as const;

/** Case · Ruling · Hearing · Appeal in plain words; 2×2 below 900 px. */
export function Glossary() {
    const { t } = useTranslation();
    return (
        <dl className="m-0 grid grid-cols-2 border-y border-ink min-[900px]:grid-cols-4">
            {TERMS.map((term, index) => (
                <div
                    key={term}
                    className={
                        "flex flex-col gap-1 py-3.5 pr-4 " +
                        (index % 2 === 1 ? "border-l border-rule pl-4 " : "") +
                        (index === 2 ? "min-[900px]:border-l min-[900px]:pl-4 " : "") +
                        (index > 1 ? "border-t border-rule min-[900px]:border-t-0" : "")
                    }
                >
                    <dt className="font-serif text-[19px] font-bold text-ink">{t(`glossary.${term}.term`)}</dt>
                    <dd className="m-0 text-[14px] leading-snug text-text">{t(`glossary.${term}.meaning`)}</dd>
                </div>
            ))}
        </dl>
    );
}
