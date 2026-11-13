import { useTranslation } from "react-i18next";
import { Moon, Sun } from "lucide-react";
import { useThemeContext } from "@/hooks/theme.context";
import { changeLanguage } from "@/i18n/i18n";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";
import { cn } from "@/lib/utils";
import { Segmented } from "./segmented";

export interface NavItem<T extends string> {
    id: T;
    label: string;
}

interface MastheadProps<T extends string> {
    items: NavItem<T>[];
    current: T;
    onNavigate: (id: T) => void;
    /** "Give feedback" link, on every page that shows the header. */
    feedbackHref?: string;
}

export function LanguageToggle() {
    const { t, i18n } = useTranslation();
    const language: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";
    return (
        <Segmented<AppLanguage>
            label={t("language.label")}
            size="sm"
            value={language}
            onChange={(next) => void changeLanguage(next)}
            options={[
                { value: "en", label: t("language.en"), ariaLabel: t("language.enName"), lang: "en" },
                { value: "es", label: t("language.es"), ariaLabel: t("language.esName"), lang: "es" },
            ]}
        />
    );
}

export function ThemeToggle() {
    const { t } = useTranslation();
    const { isDark, toggleTheme } = useThemeContext();
    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
            className="flex min-h-9 min-w-10 items-center justify-center border border-ink text-ink hover:bg-paper-hover"
        >
            {isDark ? <Sun aria-hidden="true" className="size-4" /> : <Moon aria-hidden="true" className="size-4" />}
        </button>
    );
}

/** Wordmark, main navigation, EN/ES and theme toggles, over a 1 px ink rule. */
export function Masthead<T extends string>({ items, current, onNavigate, feedbackHref }: MastheadProps<T>) {
    const { t } = useTranslation();
    return (
        <header className="mx-auto w-full max-w-[1360px] px-4 pt-3.5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink pb-2.5">
                <span className="font-serif text-[22px] font-black text-ink">{t("app.title")}</span>
                <nav aria-label={t("nav.label")} className="flex flex-wrap gap-6 text-[15px] font-semibold">
                    {items.map((item) => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            aria-current={item.id === current ? "page" : undefined}
                            onClick={(event) => {
                                event.preventDefault();
                                onNavigate(item.id);
                            }}
                            className={cn(
                                "border-b-2 py-1.5 text-ink no-underline",
                                item.id === current ? "border-action" : "border-transparent hover:border-ink",
                            )}
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {feedbackHref && (
                        <a href={feedbackHref} className="inline-flex min-h-9 items-center text-[14px] font-semibold text-action-text underline underline-offset-2 hover:text-ink">
                            {t("feedback.link")}
                        </a>
                    )}
                    <div className="flex items-center gap-2">
                        <LanguageToggle />
                        <ThemeToggle />
                    </div>
                </div>
            </div>
        </header>
    );
}
