import { describe, expect, it } from "vitest";
import {
    DEFAULT_LANGUAGE,
    LANGUAGE_STORAGE_KEY,
    languageFromBrowser,
    readLanguagePreference,
    writeLanguagePreference,
} from "./language-preference";

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
    };
}

describe("language preference", () => {
    it("defaults to English when nothing is stored and the browser language is not supported", () => {
        expect(readLanguagePreference(memoryStorage(), ["fr-FR", "de"])).toBe("en");
        expect(readLanguagePreference(memoryStorage(), [])).toBe("en");
        expect(DEFAULT_LANGUAGE).toBe("en");
    });

    it("uses the browser language before the user has chosen one", () => {
        expect(readLanguagePreference(memoryStorage(), ["es-ES", "en"])).toBe("es");
        expect(readLanguagePreference(memoryStorage(), ["fr", "ES-mx"])).toBe("es");
        expect(languageFromBrowser(["en-GB"])).toBe("en");
    });

    it("prefers the saved choice over the browser language", () => {
        expect(readLanguagePreference(memoryStorage({ [LANGUAGE_STORAGE_KEY]: "en" }), ["es-ES"])).toBe("en");
        expect(readLanguagePreference(memoryStorage({ [LANGUAGE_STORAGE_KEY]: "es" }), ["en-GB"])).toBe("es");
    });

    it("stores and reads back Spanish under the app key only", () => {
        const storage = memoryStorage();
        writeLanguagePreference("es", storage);
        expect(readLanguagePreference(storage)).toBe("es");
        expect([...storage.values.keys()]).toEqual([LANGUAGE_STORAGE_KEY]);
    });

    it("ignores unsupported stored values", () => {
        expect(readLanguagePreference(memoryStorage({ [LANGUAGE_STORAGE_KEY]: "fr" }))).toBe("en");
    });

    it("falls back to English when storage is unavailable or throws", () => {
        expect(readLanguagePreference(undefined)).toBe("en");
        const throwing = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
        };
        expect(readLanguagePreference(throwing)).toBe("en");
        expect(() => writeLanguagePreference("es", throwing)).not.toThrow();
    });
});
