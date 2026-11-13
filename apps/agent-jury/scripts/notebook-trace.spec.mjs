import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkNotebookSql } from "./notebook-sql-policy.mjs";

// Runs the trace builder of the real notebook in Python (the block between BEGIN/END TRACE BUILDER), so the code that
// decides what is stored is tested as it will run. Skipped when no Python is installed.
const source = readFileSync(resolve(import.meta.dirname, "..", "fabric", "notebooks", "evaluate_agent.py"), "utf8");
const builder = source.split("# BEGIN TRACE BUILDER")[1]?.split("# END TRACE BUILDER")[0] ?? "";
const python = spawnSync("python", ["--version"], { encoding: "utf8" }).status === 0 ? "python" : undefined;

function run(rows) {
    const script = `${builder}\nimport json, sys\nrows = json.loads(sys.stdin.read())\nprint(json.dumps([list(build_trace(r)) for r in rows]))`;
    const result = spawnSync(python, ["-c", script], { input: JSON.stringify(rows), encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
    return JSON.parse(result.stdout);
}

const DAX = `EVALUATE ROW("Customers", COUNTROWS(FILTER(ALL('Customer'), 'Customer'[Country] = "Spain")))`;
const realShape = {
    function_names: "['trace.analyze_semantic_model', 'analyze.database.nl2code', 'analyze.database.execute']",
    function_queries: "['Count the customers in Spain.', 'Count the customers in Spain.', 'Count the customers in Spain.']",
    function_outputs: "['RESULT-TABLE-MARKER', 'RESULT-TABLE-MARKER', 'RESULT-TABLE-MARKER 141']",
    sql_steps: "['None', 'None', 'None']",
    kql_steps: "['None', 'None', 'None']",
};

describe.skipIf(!python)("evaluate_agent trace builder", () => {
    it("keeps the sources and the generated query, and never the results", () => {
        const [[text, truncated]] = run([{ ...realShape, dax_steps: JSON.stringify([null, DAX, DAX]).replace(/null/g, "'None'") }]);
        const steps = JSON.parse(text);
        expect(truncated).toBe(false);
        expect(steps.map((step) => step.k)).toEqual(["source", "source", "query"]);
        expect(steps[0]).toEqual({ k: "source", tool: "trace.analyze_semantic_model", request: "Count the customers in Spain." });
        expect(steps[2]).toEqual({ k: "query", lang: "dax", code: DAX });
        expect(text).not.toContain("RESULT-TABLE-MARKER");
        expect(text).not.toContain("execute");
    });

    it("accepts real lists as well as the string form the SDK stores", () => {
        const [[text]] = run([{ function_names: ["a.tool"], function_queries: ["Ask."], dax_steps: [DAX], sql_steps: ["None"], function_outputs: ["RESULT-TABLE-MARKER"] }]);
        expect(JSON.parse(text)).toEqual([{ k: "source", tool: "a.tool", request: "Ask." }, { k: "query", lang: "dax", code: DAX }]);
    });

    it("keeps SQL and KQL with their language", () => {
        const [[text]] = run([{ function_names: ["a.tool"], function_queries: ["Ask."], dax_steps: ["None"], sql_steps: ["SELECT 1"], kql_steps: ["T | take 1"] }]);
        expect(JSON.parse(text).filter((step) => step.k === "query")).toEqual([
            { k: "query", lang: "sql", code: "SELECT 1" },
            { k: "query", lang: "kql", code: "T | take 1" },
        ]);
    });

    it("removes URLs and GUIDs", () => {
        const guid = "00000000-0000-4000-8000-000000000001";
        const [[text]] = run([{ function_names: ["a.tool"], function_queries: [`See https://example.com/x?y=1 for ${guid}.`], dax_steps: [`EVALUATE ROW("id", "${guid}")`] }]);
        expect(text).not.toMatch(/https?:|0000-4000/);
    });

    it("stays within 4000 characters and says it was cut", () => {
        const big = `EVALUATE ${"x".repeat(1400)}`;
        const rows = { function_names: ["a.tool"], function_queries: ["Ask."], dax_steps: [big + "1", big + "2", big + "3", big + "4"], sql_steps: [big + "5", big + "6"] };
        const [[text, truncated]] = run([rows]);
        expect(text.length).toBeLessThanOrEqual(4000);
        expect(truncated).toBe(true);
        expect(() => JSON.parse(text)).not.toThrow();
    });

    it("returns nothing when there are no steps", () => {
        expect(run([{}, { function_names: "not a list" }, { function_names: ["a.execute"], function_queries: ["Ask."] }])).toEqual([[null, false], [null, false], [null, false]]);
    });

    it("passes the notebook SQL policy", () => {
        expect(checkNotebookSql(source)).toEqual([]);
    });
});
