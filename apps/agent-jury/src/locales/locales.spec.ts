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

    it("have only non-empty string values", () => {
        for (const [key, value] of [...enEntries, ...esEntries]) {
            expect(typeof value, key).toBe("string");
            expect((value as string).trim(), key).not.toBe("");
        }
    });
});
