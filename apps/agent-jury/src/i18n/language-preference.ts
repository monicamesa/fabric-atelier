export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = "en";

// The only browser storage the app uses (AGENTS.md rule 2).
export const LANGUAGE_STORAGE_KEY = "agent-jury.language";

export const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
    en: "en-GB",
    es: "es-ES",
};

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function isAppLanguage(value: unknown): value is AppLanguage {
    return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

function browserStorage(): PreferenceStorage | undefined {
    try {
        return window.localStorage;
    } catch {
        // Storage can be blocked inside a sandboxed iframe.
        return undefined;
    }
}

function browserLanguages(): readonly string[] {
    if (typeof navigator === "undefined") return [];
    return navigator.languages?.length ? navigator.languages : [navigator.language];
}

/** The first browser language the app supports (es-ES → es), else English. */
export function languageFromBrowser(languages: readonly string[] = browserLanguages()): AppLanguage {
    for (const tag of languages) {
        const primary = tag?.toLowerCase().split("-")[0];
        if (isAppLanguage(primary)) return primary;
    }
    return DEFAULT_LANGUAGE;
}

/** The saved choice when there is one; before the user has chosen, the browser language. */
export function readLanguagePreference(
    storage: PreferenceStorage | undefined = browserStorage(),
    languages: readonly string[] = browserLanguages(),
): AppLanguage {
    try {
        const stored = storage?.getItem(LANGUAGE_STORAGE_KEY);
        return isAppLanguage(stored) ? stored : languageFromBrowser(languages);
    } catch {
        return languageFromBrowser(languages);
    }
}

export function writeLanguagePreference(
    language: AppLanguage,
    storage: PreferenceStorage | undefined = browserStorage(),
): void {
    try {
        storage?.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
        // Not remembering the choice is acceptable; the app keeps working in the chosen language.
    }
}
