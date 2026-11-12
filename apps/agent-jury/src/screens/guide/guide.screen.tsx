import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { PageHeader } from "@/components/docket/page-header";
import { guideHtml } from "@/guide/guide";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";

/** The user guide, rendered in the app in the selected language (docs/user-guide*.md, bundled at build time). */
export function GuideScreen({ onBack }: { onBack: () => void }) {
    const { t, i18n } = useTranslation();
    const language: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";

    return (
        <div className="flex flex-col gap-8">
            <PageHeader kicker={t("guide.kicker")} title={t("guide.title")} help={t("guide.help")} aside={<BackButton onBack={onBack} label={t("guide.back")} />} />
            <article lang={language} aria-label={t("guide.title")} className="guide-prose" dangerouslySetInnerHTML={{ __html: guideHtml(language) }} />
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
