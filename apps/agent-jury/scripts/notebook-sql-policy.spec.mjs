import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkNotebookSql } from "./notebook-sql-policy.mjs";

const notebooks = resolve(import.meta.dirname, "..", "fabric", "notebooks");
const rules = (source) => checkNotebookSql(source).map((violation) => violation.rule);

describe("notebook SQL policy", () => {
    it("accepts reads of Hearings and HearingCases and inserts into Verdicts and HearingEvents", () => {
        const source = `
cursor.execute("SELECT id, question FROM dbo.[HearingCases] WHERE hearing_id = ?", hearing_id)
cursor.execute("select id from dbo.Hearings where id = ?", hearing_id)
cursor.execute("INSERT INTO dbo.[Verdicts] (id, hearing_id) VALUES (NEWID(), ?)", hearing_id)
cursor.execute("INSERT INTO dbo.[VerdictTraces] (id, verdict_id) VALUES (NEWID(), ?)", verdict_id)
cursor.execute('''
    INSERT INTO dbo.HearingEvents (id, hearing_id, kind)
    VALUES (NEWID(), ?, 'progress')
''', hearing_id)
`;
        expect(checkNotebookSql(source)).toEqual([]);
    });

    it.each([
        ["CREATE TABLE dbo.Scratch (id INT)", "CREATE is not allowed"],
        ["ALTER TABLE dbo.Verdicts ADD x INT", "ALTER is not allowed"],
        ["DROP TABLE dbo.Verdicts", "DROP is not allowed"],
        ["TRUNCATE TABLE dbo.Verdicts", "TRUNCATE is not allowed"],
        ["UPDATE dbo.Verdicts SET judgeVerdict = 'correct'", "UPDATE is not allowed"],
        ["delete from dbo.Verdicts", "DELETE is not allowed"],
        ["MERGE dbo.Verdicts AS t USING x ON 1=1", "MERGE is not allowed"],
        ["UPDATE dbo.VerdictTraces SET steps = ''", "UPDATE is not allowed"],
        ["EXEC sp_executesql N'select 1'", "EXEC is not allowed"],
        ["GRANT SELECT ON dbo.Cases TO public", "GRANT is not allowed"],
    ])("rejects %s", (statement, rule) => {
        expect(rules(`cursor.execute("${statement}")`)).toContain(rule);
    });

    it("rejects inserts into other tables and reads of other tables", () => {
        expect(rules(`cursor.execute("INSERT INTO dbo.[Votes] (id) VALUES (NEWID())")`)).toEqual([expect.stringContaining("inserts into Votes")]);
        expect(rules(`cursor.execute("SELECT * FROM dbo.[Cases]")`)).toEqual([expect.stringContaining("reads table Cases")]);
        expect(rules(`cursor.execute("SELECT h.id FROM dbo.Hearings h JOIN dbo.Jurors j ON 1=1")`)).toEqual([expect.stringContaining("reads table Jurors")]);
        expect(rules(`cursor.execute("INSERT INTO dbo.Verdicts SELECT * FROM dbo.Cases")`)).toEqual([expect.stringContaining("INSERT ... SELECT reads table Cases")]);
        expect(rules(`cursor.execute("SELECT * INTO dbo.Copy FROM dbo.Hearings")`)).toContain("SELECT INTO creates a table");
    });

    it("rejects several statements in one call and computed table names", () => {
        expect(rules(`cursor.execute("INSERT INTO dbo.Verdicts (id) VALUES (NEWID()); DROP TABLE dbo.Verdicts")`)).toContain("one statement per call");
        expect(rules(`cursor.execute(f"INSERT INTO dbo.{table} (id) VALUES (NEWID())")`)).toEqual([expect.stringContaining("only Verdicts, HearingEvents, VerdictTraces are allowed")]);
    });

    it("rejects other ways of writing to the database", () => {
        expect(rules("frame.to_sql('Verdicts', engine)")).toContain("DataFrame.to_sql writes tables");
        expect(rules("df.write.mode('append').saveAsTable('x')")).toContain("Spark writers are not allowed");
        expect(rules("notebookutils.data.connect_to_artifact('x')")).toContain("notebookutils.data connections bypass this check");
    });

    it("ignores comments and ordinary text", () => {
        const source = `
# DROP TABLE dbo.Verdicts is never allowed
print("Could not update the verdict, will retry")
`;
        expect(checkNotebookSql(source)).toEqual([]);
    });

    it("holds for every real notebook in fabric/notebooks; the spikes are the only place with DDL", () => {
        const real = readdirSync(notebooks).filter((name) => name.endsWith(".py"));
        for (const name of real) {
            expect(checkNotebookSql(readFileSync(join(notebooks, name), "utf8")), name).toEqual([]);
        }
        const scratch = join(notebooks, "spikes", "evaluate_agent_s5.py");
        expect(existsSync(scratch)).toBe(true);
        expect(rules(readFileSync(scratch, "utf8"))).toEqual(expect.arrayContaining(["CREATE is not allowed", "DROP is not allowed"]));
    });
});

