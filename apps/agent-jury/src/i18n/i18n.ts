import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import {
    DEFAULT_LANGUAGE,
    readLanguagePreference,
    writeLanguagePreference,
    type AppLanguage,
} from "./language-preference";

export const i18n: I18n = i18next.createInstance();

/** Initialises translations synchronously; the bundles are part of the build. */
export function initI18n(language: AppLanguage = readLanguagePreference()): I18n {
    if (!i18n.isInitialized) {
        void i18n.use(initReactI18next).init({
            resources: { en: { translation: en }, es: { translation: es } },
            lng: language,
            fallbackLng: DEFAULT_LANGUAGE,
            supportedLngs: ["en", "es"],
            interpolation: { escapeValue: false },
            initAsync: false,
        });
    }
    return i18n;
}

export async function changeLanguage(language: AppLanguage): Promise<void> {
    await i18n.changeLanguage(language);
    writeLanguagePreference(language);
    document.documentElement.lang = language;
}
