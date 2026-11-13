import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { PageHeader } from "@/components/docket/page-header";
import { guideHtml } from "@/guide/guide";
import { STAGES } from "@/guide/stages";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";
import { Journey } from "./journey";
import { StageIllustration } from "./stage-illustration";

const FAQ = ["vote", "approver", "disagree", "criteria", "caselaw"] as const;

/**
 * "How to play": the five stages as a drawn journey, one block per stage (an illustration, what you do, what you
 * see and one real example), the questions people ask as an accordion, and the full rules, collapsed, at the bottom
 * (docs/user-guide*.md, bundled at build time so jurors never leave the app).
 */
export function GuideScreen({ onBack }: { onBack: () => void }) {
    const { t, i18n } = useTranslation();
    const language: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";

    return (
        <div className="flex flex-col gap-10">
            <PageHeader kicker={t("guide.kicker")} title={t("guide.title")} help={t("guide.help")} aside={<BackButton onBack={onBack} label={t("guide.back")} />} />

            <Journey />

            <div className="flex flex-col">
                {STAGES.map((stage, index) => (
                    <section
                        key={stage}
                        id={`guide-stage-${stage}`}
                        aria-labelledby={`guide-stage-${stage}-title`}
                        className="grid gap-6 border-t border-ink py-8 min-[900px]:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] min-[900px]:gap-10"
                    >
                        <StageIllustration stage={stage} alt={t(`guide.stages.${stage}.alt`)} />
                        <div className="flex flex-col gap-4">
                            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-action-text">{t("guide.labels.stage", { number: index + 1 })}</span>
                            <h2 id={`guide-stage-${stage}-title`} className="m-0 font-serif text-[36px] font-black leading-none tracking-[-0.02em] text-ink">
                                {t(`guide.stages.${stage}.title`)}
                            </h2>
                            <p className="m-0 text-[17px] leading-normal text-text">
                                <b className="text-ink">{t("guide.labels.do")}</b> · {t(`guide.stages.${stage}.do`)}
                            </p>
                            <p className="m-0 text-[17px] leading-normal text-text">
                                <b className="text-ink">{t("guide.labels.see")}</b> · {t(`guide.stages.${stage}.see`)}
                            </p>
                            <p className="m-0 border-l-4 border-action pl-3 text-[16px] leading-normal text-text">
                                <b className="text-ink">{t("guide.labels.example")}</b> · {t(`guide.stages.${stage}.example`)}
                            </p>
                        </div>
                    </section>
                ))}
            </div>

            <section aria-labelledby="guide-faq-title" className="flex flex-col gap-2 border-t-[6px] border-double border-ink pt-6">
                <h2 id="guide-faq-title" className="m-0 font-serif text-[32px] font-black text-ink">
                    {t("guide.faq.title")}
                </h2>
                <div className="flex flex-col">
                    {FAQ.map((item) => (
                        <details key={item} className="border-b border-rule">
                            <summary className="flex min-h-12 cursor-pointer items-center py-2 text-[18px] font-semibold text-ink">{t(`guide.faq.${item}.q`)}</summary>
                            <p className="m-0 max-w-[760px] pb-4 text-[16px] leading-normal text-text">{t(`guide.faq.${item}.a`)}</p>
                        </details>
                    ))}
                </div>
            </section>

            <details className="border border-ink bg-paper-raised">
                <summary className="flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2">
                    <span className="font-serif text-[24px] font-bold text-ink">{t("guide.rules.title")}</span>
                    <span className="text-[14px] text-text-muted">{t("guide.rules.help")}</span>
                </summary>
                <article lang={language} aria-label={t("guide.rules.title")} className="guide-prose px-4 pb-6" dangerouslySetInnerHTML={{ __html: guideHtml(language) }} />
            </details>
        </div>
    );
}

function BackButton({ onBack, label }: { onBack: () => void; label: string }) {
    return (
        <div className="flex items-start min-[900px]:justify-end">
            <Button variant="secondary" onClick={onBack}>
                ← {label}
            </Button>
        </div>
    );
}
