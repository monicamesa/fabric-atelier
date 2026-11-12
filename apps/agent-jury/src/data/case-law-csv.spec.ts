import { describe, expect, it } from "vitest";
import type { JurorRecord } from "@/rules/case-validity";
import { buildDocket, type DocketRecords } from "./docket";
import type { CaseRow, TestimonyRow, VoteRow } from "./cases.service";
import { buildCaseLaw, caseLawFilename, caseLawTags, CASE_LAW_HEADER, neutraliseFormula, quoteCell, slugify, toCaseLawCsv } from "./case-law-csv";

// Example-style identities are used only to build fixtures; real authors below use other domains so they are exportable.
const NOW = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const jurors: JurorRecord[] = [
    { email: "ana.acme", role: "expert", active: true },
    { email: "bruno.acme", role: "approver", active: true },
    { email: "elena.acme", role: "expert", active: true },
];
const sub = (email: string) => `sub-${email.split(".")[0]}`;
let n = 0;
const caseRow = (id: string, text: string, parts: Partial<CaseRow> = {}, author = "ana.acme") =>
    ({ id, agent_id: "agent-1", text, category: "Sales", tags: null, authorUserId: sub(author), authorEmail: author, createdAt: at(-600 - (n += 1)), ...parts }) as unknown as CaseRow;
const testimony = (id: string, caseId: string, answer: string, parts: Partial<TestimonyRow> = {}, author = "ana.acme") =>
    ({ id, case_id: caseId, answer, definition: "d", authorUserId: sub(author), authorEmail: author, createdAt: at(-590), ...parts }) as unknown as TestimonyRow;
const vote = (testimonyId: string, who: string, minutes = -300) =>
    ({ id: `v${(n += 1)}`, testimony_id: testimonyId, value: "for", comment: null, voterUserId: sub(who), voterEmail: who, createdAt: at(minutes) }) as unknown as VoteRow;
const ruledVotes = (testimonyId: string) => [vote(testimonyId, "elena.acme"), vote(testimonyId, "bruno.acme")];

function docket(parts: Partial<DocketRecords> & Pick<DocketRecords, "cases" | "testimonies" | "votes">) {
    return buildDocket({ dismissals: [], ...parts }, jurors, undefined, NOW, "agent-1");
}

describe("buildCaseLaw: which cases are exported", () => {
    it("exports only ruled cases, with the ruled answer", () => {
        const d = docket({
            cases: [caseRow("c1", "How many orders in 2026?"), caseRow("c2", "Still under review?"), caseRow("c3", "Disputed?")],
            testimonies: [testimony("t1", "c1", "997"), testimony("t2", "c2", "1"), testimony("t3", "c3", "A", {}, "elena.acme"), testimony("t4", "c3", "B")],
            votes: [...ruledVotes("t1"), vote("t2", "elena.acme"), vote("t3", "bruno.acme"), vote("t4", "elena.acme")],
        });
        expect(buildCaseLaw(d.cases)).toEqual([{ question: "How many orders in 2026?", expected_answer: "997", category: "Sales", tags: "" }]);
    });

    it("leaves out dismissed cases and cases by people who are not active jurors", () => {
        const d = docket({
            cases: [caseRow("c1", "Dismissed?"), caseRow("c2", "By a stranger?", {}, "eva.outsider"), caseRow("c3", "Fine?")],
            testimonies: [testimony("t1", "c1", "1"), testimony("t2", "c2", "2", {}, "eva.outsider"), testimony("t3", "c3", "3")],
            votes: [...ruledVotes("t1"), ...ruledVotes("t2"), ...ruledVotes("t3")],
            dismissals: [{ id: "d1", case_id: "c1", reason: "x", dismissedByUserId: sub("ana.acme"), dismissedByEmail: "ana.acme", createdAt: at(-5) } as never],
        });
        expect(buildCaseLaw(d.cases).map((row) => row.question)).toEqual(["Fine?"]);
    });

    it("leaves out example and seeded data: 'example-' user ids and example.com addresses", () => {
        const d = docket({
            cases: [
                caseRow("c1", "Example author id?", { authorUserId: "example-bruno.expert" }),
                caseRow("c2", "Example address?", { authorEmail: "carla@example.com" }),
                caseRow("c3", "Example answer?"),
                caseRow("c4", "Real?"),
            ],
            testimonies: [
                testimony("t1", "c1", "1"),
                testimony("t2", "c2", "2"),
                testimony("t3", "c3", "3", { authorUserId: "example-dario.admin" }),
                testimony("t4", "c4", "4"),
            ],
            votes: [...ruledVotes("t1"), ...ruledVotes("t2"), ...ruledVotes("t3"), ...ruledVotes("t4")],
        });
        expect(buildCaseLaw(d.cases).map((row) => row.question)).toEqual(["Real?"]);
    });

    it("leaves out a case reopened by an approver's expected_answer_wrong review (R9), until the jury rules again", () => {
        const base = {
            cases: [caseRow("c1", "Spain customers?")],
            testimonies: [testimony("t1", "c1", "141")],
            votes: ruledVotes("t1"),
            reviews: {
                available: true,
                hearings: [{ id: "h1", agent_id: "agent-1", criticPromptVersion: null, createdAt: at(-200) }],
                verdicts: [{ id: "v-1", hearing_id: "h1", case_id: "c1", judgeVerdict: "correct" as const, createdAt: at(-190) }],
                reviewRecords: {
                    verdicts: [{ id: "v-1", hearing_id: "h1", case_id: "c1", judgeVerdict: "correct" as const, createdAt: at(-190) }],
                    hearingCases: [{ hearing_id: "h1", case_id: "c1", testimony_id: "t1" }],
                    reviews: [
                        { id: "r1", verdict_id: "v-1", humanVerdict: "incorrect" as const, reason: "expected_answer_wrong" as const, comment: "Count by shipping country.", reviewerUserId: sub("bruno.acme"), reviewerEmail: "bruno.acme", createdAt: at(-100) },
                    ],
                },
            },
        };
        expect(buildCaseLaw(docket(base).cases)).toEqual([]);
        const rulesAgain = docket({ ...base, votes: [...base.votes, vote("t1", "elena.acme", -50), vote("t1", "bruno.acme", -40)] });
        expect(buildCaseLaw(rulesAgain.cases)).toHaveLength(1);
    });

    it("has no rows for an empty docket", () => {
        expect(buildCaseLaw([])).toEqual([]);
    });
});

describe("category and tags", () => {
    const ruling = testimony("t1", "c1", "x", { criterion: "At least one order", timeWindow: "Last 90 days", population: "All customers", source: "FactSales" });

    it("takes the category from the case and the tags from the case tags plus the structured definition, separated by ';'", () => {
        expect(caseLawTags("revenue, Q1 ,customers", ruling)).toBe("revenue;Q1;customers;criterion: At least one order;time window: Last 90 days;population: All customers;source: FactSales");
    });

    it("drops empty and repeated tags, and never leaves a ';' or ',' inside a tag", () => {
        expect(caseLawTags("a, A, ,b;c", testimony("t", "c", "x", { source: "Customer[Country]; ShipTo, X" }))).toBe("a;b;c;source: Customer[Country] ShipTo X");
        expect(caseLawTags(null, testimony("t", "c", "x"))).toBe("");
    });

    it("puts them in the row", () => {
        const d = docket({
            cases: [caseRow("c1", "Active customers?", { category: "  Customers ", tags: "kpi,monthly" })],
            testimonies: [testimony("t1", "c1", "1,480", { timeWindow: "Last 90 days" })],
            votes: ruledVotes("t1"),
        });
        expect(buildCaseLaw(d.cases)).toEqual([{ question: "Active customers?", expected_answer: "1,480", category: "Customers", tags: "kpi;monthly;time window: Last 90 days" }]);
    });
});

describe("CSV", () => {
    it("has the exact Quality Lab header, a UTF-8 BOM and CRLF line endings", () => {
        const csv = toCaseLawCsv([]);
        expect(CASE_LAW_HEADER.join(",")).toBe("question,expected_answer,category,tags");
        expect(csv).toBe("\uFEFFquestion,expected_answer,category,tags\r\n");
        expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it("quotes cells with commas, quotes and line breaks (RFC 4180), doubling the quotes", () => {
        expect(quoteCell("plain")).toBe("plain");
        expect(quoteCell("a,b")).toBe('"a,b"');
        expect(quoteCell('say "hi"')).toBe('"say ""hi"""');
        expect(quoteCell("two\nlines")).toBe('"two\nlines"');
        expect(quoteCell("cr\rhere")).toBe('"cr\rhere"');
    });

    it("keeps accents and non-Latin text as they are", () => {
        const csv = toCaseLawCsv([{ question: "¿Cuántos clientes hay en España?", expected_answer: "141", category: "Clientes", tags: "año;ñandú" }]);
        expect(csv).toContain("¿Cuántos clientes hay en España?,141,Clientes,año;ñandú\r\n");
    });

    it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tTabbed", "=HYPERLINK(\"http://x\")"])("neutralises the formula %j with a leading apostrophe", (cell) => {
        expect(neutraliseFormula(cell)).toBe(`'${cell}`);
    });

    it("leaves ordinary text and plain numbers alone, because a plain number cannot run as a formula", () => {
        for (const cell of ["revenue", "997", "-5", "+1.5", "-12,5", "50%", "2,147,910.60", ""]) expect(neutraliseFormula(cell)).toBe(cell);
    });

    it("neutralises before quoting, in every column", () => {
        const csv = toCaseLawCsv([{ question: "=1+1", expected_answer: "-1+1, ok", category: "@x", tags: "+y;z" }]);
        expect(csv.split("\r\n")[1]).toBe(`'=1+1,"'-1+1, ok",'@x,'+y;z`);
    });

    it("writes one row per case, in the given order", () => {
        const csv = toCaseLawCsv([
            { question: "Q1", expected_answer: "A1", category: "C", tags: "" },
            { question: "Q2", expected_answer: "A2", category: "C", tags: "t" },
        ]);
        expect(csv.split("\r\n")).toEqual(["\uFEFFquestion,expected_answer,category,tags", "Q1,A1,C,", "Q2,A2,C,t", ""]);
    });

    it("contains no author, email or id: only the four columns", () => {
        const d = docket({
            cases: [caseRow("00000000-0000-4000-8000-000000000099", "Q?", {}, "ana.acme")],
            testimonies: [testimony("t1", "00000000-0000-4000-8000-000000000099", "A", {}, "ana.acme")],
            votes: ruledVotes("t1"),
        });
        const csv = toCaseLawCsv(buildCaseLaw(d.cases));
        expect(csv).not.toMatch(/acme|sub-|@|00000000-0000/);
    });
});

describe("file name", () => {
    it("is agent-jury-<slug>-case-law-<yyyy-mm-dd>.csv", () => {
        expect(caseLawFilename("Sales Agent", new Date(2026, 10, 12, 9, 5))).toBe("agent-jury-sales-agent-case-law-2026-11-12.csv");
        expect(caseLawFilename("Agente de Ventas (ejemplo) ñ", new Date(2026, 0, 3))).toBe("agent-jury-agente-de-ventas-ejemplo-n-case-law-2026-01-03.csv");
    });

    it("slugifies awkward names and has a fallback", () => {
        expect(slugify("  Finance / Q1 – 2026!! ")).toBe("finance-q1-2026");
        expect(slugify("???")).toBe("agent");
    });
});
