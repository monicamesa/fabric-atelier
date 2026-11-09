import type { AppLanguage } from "@/i18n/language-preference";
import { LOCALE_BY_LANGUAGE } from "@/i18n/language-preference";

export function formatDate(value: Date | string, language: AppLanguage): string {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: Date | string, language: AppLanguage): string {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function formatNumber(value: number, language: AppLanguage, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], options).format(value);
}

/** "Today", "Yesterday", "3 days ago" for the last week, then the day and month. Calendar days, local time. */
export function formatRelativeDay(value: Date | string, language: AppLanguage, now: Date = new Date()): string {
    const date = typeof value === "string" ? new Date(value) : value;
    const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
    if (days < 0 || days > 6) return formatLogDay(date, language, now).text;
    const text = new Intl.RelativeTimeFormat(LOCALE_BY_LANGUAGE[language], { numeric: "auto" }).format(-days, "day");
    return text.charAt(0).toLocaleUpperCase(LOCALE_BY_LANGUAGE[language]) + text.slice(1);
}

/** Short day for lists: the time when it is today, otherwise day and month ("9 Nov"). */
export function formatLogDay(value: Date | string, language: AppLanguage, now: Date = new Date()): { today: boolean; text: string } {
    const date = typeof value === "string" ? new Date(value) : value;
    const today = date.toDateString() === now.toDateString();
    const options: Intl.DateTimeFormatOptions = today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" };
    return { today, text: new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language], options).format(date) };
}
