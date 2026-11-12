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
            "launch.slow", "launch.footer", "launch.signIn", "launch.signingIn",
            "launch.errors.session", "launch.errors.signIn", "launch.errors.notJuror", "launch.errors.busy", "launch.errors.unknown",
            "intro.pageLabel", "intro.gavelLabel", "intro.stepsLabel", "intro.skip", "intro.back", "intro.begin", "intro.next", "intro.enter", "intro.footer",
            ...["step1", "step2", "step3"].flatMap((step) => ["nav", "kicker", "titleStart", "titleHighlight", "body"].map((part) => `intro.${step}.${part}`)),
            "home.howItWorks", "states.objection", "states.technicalDetails", "common.retry",
        ];
        const enKeys = new Set(enEntries.map(([key]) => key));
        const esKeys = new Set(esEntries.map(([key]) => key));
        expect(required.filter((key) => !enKeys.has(key))).toEqual([]);
        expect(required.filter((key) => !esKeys.has(key))).toEqual([]);
    });

    it("have only non-empty string values", () => {
        for (const [key, value] of [...enEntries, ...esEntries]) {
            expect(typeof value, key).toBe("string");
            expect((value as string).trim(), key).not.toBe("");
        }
    });
});
