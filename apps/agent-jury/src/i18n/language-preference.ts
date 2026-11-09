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

export function readLanguagePreference(storage: PreferenceStorage | undefined = browserStorage()): AppLanguage {
    try {
        const stored = storage?.getItem(LANGUAGE_STORAGE_KEY);
        return isAppLanguage(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
        return DEFAULT_LANGUAGE;
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
