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

    it("avoids the 'fall…' family in Spanish except when describing the agent getting an answer wrong", () => {
        const offenders = esEntries.filter(([key, value]) => key !== "source.measuresHelp" && typeof value === "string" && /fall/i.test(value)).map(([key]) => key);
        expect(offenders).toEqual([]);
        expect(es.source.measuresHelp).toContain("el agente probablemente fallará");
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

    it("have the case-law export keys, and Spanish calls the judge's unclear verdict 'dudosa' everywhere", () => {
        const required = ["caseLaw.export", "caseLaw.help_one", "caseLaw.help_other", "caseLaw.empty", "caseLaw.reviewsUnavailable", "caseLaw.loading", "caseLaw.done_one", "caseLaw.done_other"];
        const enKeys = new Map(enEntries);
        const esKeys = new Map(esEntries);
        expect(required.filter((key) => !enKeys.has(key) || !esKeys.has(key))).toEqual([]);
        expect(esKeys.get("caseLaw.export")).toBe("Exportar jurisprudencia");
        expect(esEntries.filter(([, value]) => /sin claro/i.test(String(value)))).toEqual([]);
        expect(esKeys.get("hearings.verdicts.unclear")).toBe("Dudosa");
        expect(esKeys.get("ticker.status.unclear")).toBe("Dudosa");
        expect(enKeys.get("hearings.verdicts.unclear")).toBe("Unclear");
    });

    it("have the selector, judge-criteria, feedback, trace and language-badge keys, with the requested wording", () => {
        const enKeys = new Map(enEntries);
        const esKeys = new Map(esEntries);
        const required = [
            "selector.label", "selector.help", "home.trustStandard", "home.trustStandardHelp", "turn.seeOpen", "proposeCase.change",
            "language.questionIn", "feedback.link", "feedback.title", "feedback.message", "feedback.submit", "feedback.thanks",
            ...["idea", "confusing", "bug", "other"].map((type) => `feedback.types.${type}`),
            "clerk.tabs.feedback", "clerk.feedback.title", "clerk.feedback.empty",
            "trace.title", "trace.help", "trace.none", "trace.failed", "trace.summary_one", "trace.summary_other", "trace.copy",
        ];
        expect(required.filter((key) => !enKeys.has(key) || !esKeys.has(key))).toEqual([]);
        expect(enKeys.get("selector.label")).toBe("1 · Choose the agent ▸");
        expect(esKeys.get("selector.label")).toBe("1 · Elige el agente ▸");
        expect(enKeys.get("selector.help")).toBe("Everything you see and propose is for this agent.");
        expect(esKeys.get("selector.help")).toBe("Todo lo que ves y propones es para este agente.");
        expect(enKeys.get("home.trustStandard")).toBe("Judge: standard criteria");
        expect(esKeys.get("home.trustStandard")).toBe("Juez: criterio estándar");
        expect(enKeys.get("home.trustStandardHelp")).toBe("The AI judge uses Fabric's standard evaluation criteria. If the criteria change, trust starts again.");
        expect(esKeys.get("home.trustStandardHelp")).toBe("El juez de IA usa el criterio estándar de Fabric. Si cambia el criterio, la confianza empieza de cero.");
        expect(esKeys.get("feedback.link")).toBe("Danos tu opinión");
        expect(enKeys.get("turn.seeOpen")).toBe("See open cases");
    });

    it("have only non-empty string values", () => {
        for (const [key, value] of [...enEntries, ...esEntries]) {
            expect(typeof value, key).toBe("string");
            expect((value as string).trim(), key).not.toBe("");
        }
    });
});
