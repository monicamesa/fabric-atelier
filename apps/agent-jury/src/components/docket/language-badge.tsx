import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** The language a case question was written in. Older cases have none, and then nothing is shown. */
export function LanguageBadge({ language, className }: { language?: string | null; className?: string }) {
    const { t } = useTranslation();
    if (language !== "en" && language !== "es") return null;
    const label = t("language.questionIn", { language: t(language === "en" ? "language.enName" : "language.esName") });
    return (
        <abbr
            title={label}
            aria-label={label}
            className={cn("inline-flex h-[18px] shrink-0 items-center border border-text-muted px-1.5 align-middle font-sans text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-text-muted no-underline", className)}
        >
            {language}
        </abbr>
    );
}
