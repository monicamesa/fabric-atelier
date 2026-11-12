import { describe, expect, it } from "vitest";
import { changeLanguage, i18n, initI18n } from "./i18n";
import { LANGUAGE_STORAGE_KEY } from "./language-preference";

describe("i18n", () => {
    it("starts in English and switches to Spanish, remembering the choice", async () => {
        window.localStorage.clear();
        initI18n();
        expect(i18n.language).toBe("en");
        expect(i18n.t("caseState.under_review")).toBe("Open for votes");

        await changeLanguage("es");
        expect(i18n.t("caseState.under_review")).toBe("Abierto a votación");
        expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
        expect(document.documentElement.lang).toBe("es");

        await changeLanguage("en");
    });
});
