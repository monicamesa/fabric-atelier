import { describe, expect, it } from "vitest";
import type { JurorRecord } from "@/rules/case-validity";
import { buildDocket, canonicalCategory, normalizeCategory, type DocketRecords } from "./docket";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const jurors: JurorRecord[] = [
    { email: "ana.expert@example.com", role: "expert", active: true },
    { email: "bruno.approver@example.com", role: "approver", active: true },
    { email: "elena.expert@example.com", role: "expert", active: true },
];
const caseRow = (id: string, category: string, author = "ana.expert@example.com") => ({
    id,
    agent_id: "agent-1",
    text: `Question ${id}`,
    category,
    authorUserId: `sub-${author.split(".")[0]}`,
    authorEmail: author,
    createdAt: at(-60),
});

const raw: DocketRecords = {
    cases: [caseRow("c1", "Sales"), caseRow("c2", "sales "), caseRow("c3", "Finance", "elena.expert@example.com")],
    testimonies: [
        { id: "t1", case_id: "c1", answer: "42", definition: "Orders in 90 days", authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: at(-50) },
    ],
    votes: [
        { id: "v1", testimony_id: "t1", value: "for", voterUserId: "sub-bruno", voterEmail: "bruno.approver@example.com", createdAt: at(-30) },
        { id: "v2", testimony_id: "t1", value: "for", voterUserId: "sub-elena", voterEmail: "elena.expert@example.com", createdAt: at(-20) },
    ],
    dismissals: [],
};

describe("docket", () => {
    it("computes each case's state from its own records", () => {
        const docket = buildDocket(raw, jurors, { userId: "sub-elena", email: "elena.expert@example.com" }, NOW);
        expect(docket.cases.map((docketCase) => docketCase.analysis.state)).toEqual(["ruled", "under_review", "under_review"]);
        expect(docket.cases.find((docketCase) => docketCase.record.id === "c3")?.proposedByMe).toBe(true);
    });

    it("lists categories once, whatever their case or spacing (D8)", () => {
        expect(buildDocket(raw, jurors, undefined, NOW).categories).toEqual(["Finance", "Sales"]);
        expect(normalizeCategory("  Net   revenue ")).toBe("Net revenue");
        expect(canonicalCategory(" SALES", ["Finance", "Sales"])).toBe("Sales");
        expect(canonicalCategory("Returns", ["Finance", "Sales"])).toBe("Returns");
    });

    it("feeds the ticker with verdicts only, newest first", () => {
        const ticker = buildDocket(raw, jurors, undefined, NOW).ticker;
        expect(ticker[0]).toMatchObject({ caseId: "c1", event: { kind: "state", state: "ruled" } });
        expect(ticker.every(({ event }) => event.kind === "state" && ["ruled", "disputed", "dismissed"].includes(event.state))).toBe(true);
    });
});
