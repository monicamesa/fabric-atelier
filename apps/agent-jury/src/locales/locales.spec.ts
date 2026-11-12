import { describe, expect, it } from "vitest";
import en from "./en.json";
import es from "./es.json";

function leafEntries(value: unknown, prefix = ""): [string, unknown][] {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return [[prefix, value]];
    }
    return Object.entries(value).flatMap(([key, child]) => leafEntries(child, prefix ? `${prefix}.${key}` : key));
}

describe("translation files", () => {
    const enEntries = leafEntries(en);
    const esEntries = leafEntries(es);

    it("have exactly the same keys", () => {
        expect(esEntries.map(([key]) => key).sort()).toEqual(enEntries.map(([key]) => key).sort());
    });

    it("never use the 'fall…' family in Spanish (fallo, falla, fallado, fallida): it reads as 'failed' (ruled = resuelto, ruling = resolución)", () => {
        const offenders = esEntries.filter(([, value]) => typeof value === "string" && /fall/i.test(value)).map(([key]) => key);
        expect(offenders).toEqual([]);
    });

    it("have the launch screen, intro and how-it-works keys in both languages", () => {
        const required = [
            "launch.kicker", "launch.headlineStart", "launch.headlineEnd", "launch.gavelLabel",
            "launch.session", "launch.docket", "launch.ready", "launch.step1", "launch.step2", "launch.step3",
            "launch.slow", "launch.footer", "launch.signIn", "launch.signingIn", "launch.copySignInName", "launch.sendToAdmin",
            "launch.errors.session", "launch.errors.signIn", "launch.errors.notJuror", "launch.errors.busy", "launch.errors.unknown",
            "intro.pageLabel", "intro.gavelLabel", "intro.stepsLabel", "intro.skip", "intro.back", "intro.begin", "intro.next", "intro.enter", "intro.footer",
            ...["step1", "step2", "step3"].flatMap((step) => ["nav", "kicker", "titleStart", "titleHighlight", "body"].map((part) => `intro.${step}.${part}`)),
            "home.howItWorks", "caseDetail.reviewsUnavailable", "states.objection", "states.technicalDetails", "common.retry",
        ];
        const enKeys = new Set(enEntries.map(([key]) => key));
        const esKeys = new Set(esEntries.map(([key]) => key));
        expect(required.filter((key) => !enKeys.has(key))).toEqual([]);
        expect(required.filter((key) => !esKeys.has(key))).toEqual([]);
    });

    it("have the ticker keys in both languages, with the guide's labels", () => {
        const required = ["ticker.label", "ticker.title", "ticker.short", "ticker.pause", "ticker.status.new", "ticker.status.disputed", "ticker.status.ruled", "ticker.detail.new", "ticker.detail.disputed", "ticker.detail.ruledAll_one", "ticker.detail.ruledAll_other", "ticker.detail.ruledSome"];
        const enKeys = new Map(enEntries);
        const esKeys = new Map(esEntries);
        expect(required.filter((key) => !enKeys.has(key) || !esKeys.has(key))).toEqual([]);
        expect(enKeys.get("ticker.title")).toBe("Latest on the docket");
        expect(esKeys.get("ticker.title")).toBe("Último en el jurado");
        // In Spanish the jury "resuelve"; "veredicto" belongs to the AI judge only.
        expect(esEntries.filter(([key, value]) => key.startsWith("ticker.") && /veredicto/i.test(String(value)))).toEqual([]);
    });

    it("have only non-empty string values", () => {
        for (const [key, value] of [...enEntries, ...esEntries]) {
            expect(typeof value, key).toBe("string");
            expect((value as string).trim(), key).not.toBe("");
        }
    });
});
