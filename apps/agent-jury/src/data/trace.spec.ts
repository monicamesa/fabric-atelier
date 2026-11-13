import { describe, expect, it, vi } from "vitest";
import { loadVerdictTrace, parseTraceSteps, queryLanguages, toolKind } from "./trace";

const STEPS = JSON.stringify([
    { k: "source", tool: "trace.analyze_semantic_model", request: "Count the customers in Spain." },
    { k: "source", tool: "analyze.database.nl2code" },
    { k: "query", lang: "dax", code: "EVALUATE ROW(\"n\", 1)" },
]);

describe("parseTraceSteps", () => {
    it("reads sources and queries in order", () => {
        expect(parseTraceSteps(STEPS)).toEqual([
            { k: "source", tool: "trace.analyze_semantic_model", request: "Count the customers in Spain." },
            { k: "source", tool: "analyze.database.nl2code", request: undefined },
            { k: "query", lang: "dax", code: "EVALUATE ROW(\"n\", 1)" },
        ]);
    });

    it("drops anything that is not a well-formed step, and never throws", () => {
        expect(parseTraceSteps(undefined)).toEqual([]);
        expect(parseTraceSteps("")).toEqual([]);
        expect(parseTraceSteps("not json")).toEqual([]);
        expect(parseTraceSteps('{"k":"query"}')).toEqual([]);
        expect(parseTraceSteps(JSON.stringify([null, 3, { k: "result", rows: [[1]] }, { k: "query", lang: "python", code: "x" }, { k: "query", lang: "sql" }]))).toEqual([]);
    });

    it("does not carry result-like fields even if a row had them", () => {
        const [step] = parseTraceSteps(JSON.stringify([{ k: "source", tool: "t", request: "r", rows: [[1]], output: "table" }]));
        expect(step).toEqual({ k: "source", tool: "t", request: "r" });
    });
});

describe("helpers", () => {
    it("names the kind of tool and lists the distinct query languages", () => {
        expect(toolKind("trace.analyze_semantic_model")).toBe("semanticModel");
        expect(toolKind("analyze.database.nl2code")).toBe("toQuery");
        expect(toolKind("something.else")).toBe("other");
        expect(toolKind(undefined)).toBe("other");
        expect(queryLanguages([{ k: "query", lang: "sql", code: "a" }, { k: "query", lang: "dax", code: "b" }, { k: "query", lang: "sql", code: "c" }, { k: "source", tool: "t" }])).toEqual(["sql", "dax"]);
    });
});

describe("loadVerdictTrace", () => {
    it("reads one row by verdict id", async () => {
        const execute = vi.fn(async () => [{ id: "t1", steps: STEPS, truncated: false, sdkVersion: "0.1.36a0" }]);
        const where = vi.fn(() => ({ first: () => ({ execute }) }));
        const select = vi.fn(() => ({ where }));
        const row = await loadVerdictTrace({ data: { VerdictTrace: { select } } } as never, "v1");
        expect(select).toHaveBeenCalledWith(["id", "steps", "truncated", "sdkVersion"]);
        expect(where).toHaveBeenCalledWith({ verdict_id: { eq: "v1" } });
        expect(row?.steps).toBe(STEPS);
    });

    it("returns nothing when no trace was recorded", async () => {
        const client = { data: { VerdictTrace: { select: () => ({ where: () => ({ first: () => ({ execute: async () => [] }) }) }) } } } as never;
        expect(await loadVerdictTrace(client, "v1")).toBeUndefined();
    });
});
