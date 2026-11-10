import { describe, expect, it } from "vitest";
import type { JurorRow } from "@/data/directory.service";
import { buildDocket, type DocketRecords } from "@/data/docket";
import { applyFilter, canDiff, caseNumber, differingRows, homeRows, matchesQuery } from "./docket-views";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const jurors: JurorRow[] = [
    { id: "j1", email: "ana.expert@example.com", role: "expert", active: true },
    { id: "j2", email: "bruno.approver@example.com", role: "approver", active: true },
    { id: "j3", email: "elena.expert@example.com", role: "expert", active: true },
];
const me = { userId: "sub-elena", email: "elena.expert@example.com" };
const caseRow = (id: string, text: string, author = "ana") => ({
    id,
    agent_id: "agent-1",
    text,
    category: "Sales",
    tags: id === "c2" ? "facturación" : null,
    authorUserId: `sub-${author}`,
    authorEmail: `${author}.${author === "bruno" ? "approver" : "expert"}@example.com`,
    createdAt: at(-60),
});
const testimony = (id: string, caseId: string, author: string, extra: object = {}) => ({
    id,
    case_id: caseId,
    answer: `Answer ${id}`,
    definition: "Orders in 90 days",
    authorUserId: `sub-${author}`,
    authorEmail: `${author}.${author === "bruno" ? "approver" : "expert"}@example.com`,
    createdAt: at(-50),
    ...extra,
});
const vote = (id: string, testimonyId: string, voter: string) => ({
    id,
    testimony_id: testimonyId,
    value: "for" as const,
    voterUserId: `sub-${voter}`,
    voterEmail: `${voter}.${voter === "bruno" ? "approver" : "expert"}@example.com`,
    createdAt: at(-30),
});

// c1 ruled · c2 disputed · c3 open, waiting for Elena · c4 proposed by Elena, no answers · c5 dismissed
const raw: DocketRecords = {
    cases: [
        caseRow("c1", "Best-selling product in 2025?"),
        caseRow("c2", "Revenue in Q1 of the fiscal year?"),
        caseRow("c3", "Net revenue for fiscal year 2026, by región?"),
        caseRow("c4", "Active customers in October?", "elena"),
        caseRow("c5", "How are sales going?"),
    ],
    testimonies: [
        testimony("t1", "c1", "ana"),
        testimony("t2a", "c2", "ana"),
        testimony("t2b", "c2", "bruno"),
        testimony("t3", "c3", "ana"),
    ],
    votes: [vote("v1", "t1", "bruno"), vote("v2", "t1", "elena"), vote("v3", "t2a", "elena"), vote("v4", "t2b", "ana")],
    dismissals: [{ id: "d1", case_id: "c5", reason: "Too vague", dismissedByUserId: "sub-ana", dismissedByEmail: "ana.expert@example.com", createdAt: at(-10) }],
};
const docket = buildDocket(raw, jurors, me, NOW);
const ids = (items: { record: { id: string } }[]) => items.map((item) => item.record.id);

describe("docket views", () => {
    it("numbers cases with the last 4 characters of the id (D7 fallback)", () => {
        expect(caseNumber("00000000-0000-4000-8000-000000000062")).toBe("#0062");
        expect(caseNumber("case-id-ending-in-abcd5678")).toBe("#5678");
    });

    it("puts my pending votes first on Home, then disputes, open cases and rulings, without dismissed cases", () => {
        expect(docket.cases.map((item) => item.analysis.state)).toEqual(["ruled", "disputed", "under_review", "under_review", "dismissed"]);
        expect(ids(homeRows(docket.cases))).toEqual(["c3", "c2", "c4", "c1"]);
        expect(ids(homeRows(docket.cases, 2))).toEqual(["c3", "c2"]);
    });

    it("filters the board by my vote and by author", () => {
        expect(ids(applyFilter(docket.cases, "vote", ""))).toEqual(["c3"]);
        expect(ids(applyFilter(docket.cases, "mine", ""))).toEqual(["c4"]);
        expect(ids(applyFilter(docket.cases, "all", "fiscal"))).toEqual(["c2", "c3"]);
    });

    it("searches without case or accents, including category and tags", () => {
        const [, c2, c3] = docket.cases;
        expect(matchesQuery(c3, "REGION")).toBe(true);
        expect(matchesQuery(c2, "facturacion")).toBe(true);
        expect(matchesQuery(c2, "sales")).toBe(true);
        expect(matchesQuery(c2, "october")).toBe(false);
        expect(matchesQuery(c2, "   ")).toBe(true);
    });
});

describe("definition diff (D3)", () => {
    const plain = testimony("p", "c", "ana");
    const left = testimony("l", "c", "ana", { criterion: "An order", timeWindow: "Last 90 days", population: "All customers", source: "FactSales" });
    const right = testimony("r", "c", "bruno", { criterion: "An open contract", timeWindow: "Last 90 days ", population: "all customers", source: "DimContract" });

    it("needs the details on both answers", () => {
        expect(canDiff(left, right)).toBe(true);
        expect(canDiff(left, plain)).toBe(false);
        expect(canDiff(plain, right)).toBe(false);
    });

    it("highlights only the rows that differ, ignoring case and spacing", () => {
        expect(differingRows(left, right)).toEqual(["criterion", "source"]);
    });
});
