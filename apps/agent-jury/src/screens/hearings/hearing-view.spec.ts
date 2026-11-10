import { describe, expect, it } from "vitest";
import type { HearingCaseRow, HearingEventRow, HearingRecords, HearingRow, VerdictRow } from "@/data/hearings.service";
import { anyInSession, scoreboard, viewHearing, viewHearings } from "./hearing-view";

const AGENT = "00000000-0000-4000-8000-000000000023";
const NOW = new Date("2026-11-10T10:10:00Z");
const hearing = (id: string, startedAt: string, caseCount = 2): HearingRow => ({ id, agent_id: AGENT, stage: "production", launchedByEmail: "dario.admin@example.com", caseCount, createdAt: startedAt });
const event = (hearing_id: string, kind: HearingEventRow["kind"], createdAt: string, detail?: string): HearingEventRow => ({ id: `${hearing_id}-${kind}-${createdAt}`, hearing_id, kind, createdAt, detail });
const row = (hearing_id: string, position: number, case_id: string): HearingCaseRow => ({ id: `${hearing_id}-${position}`, hearing_id, case_id, position, question: `Q${position}`, expectedAnswer: `A${position}` });
const verdict = (hearing_id: string, case_id: string, judgeVerdict: VerdictRow["judgeVerdict"]): VerdictRow => ({
    id: `${hearing_id}-${case_id}`,
    hearing_id,
    case_id,
    agentAnswer: "x",
    judgeVerdict,
    judgeMessage: "Yes",
    createdAt: "2026-11-10T10:05:00Z",
});

const records: HearingRecords = {
    hearings: [hearing("h1", "2026-11-10T10:00:00Z"), hearing("h0", "2026-11-09T10:00:00Z")],
    cases: [row("h1", 2, "c2"), row("h1", 1, "c1"), row("h0", 1, "c1")],
    events: [
        event("h1", "launched", "2026-11-10T10:00:02Z", "job"),
        event("h1", "started", "2026-11-10T10:02:00Z"),
        event("h0", "launched", "2026-11-09T10:00:02Z"),
        event("h0", "completed", "2026-11-09T10:04:00Z"),
        event("h0", "failed", "2026-11-09T10:03:00Z", "launch: boom"),
    ],
    verdicts: [verdict("h1", "c1", "incorrect"), verdict("h0", "c1", "correct")],
};

describe("hearing view", () => {
    it("derives progress and state from the records", () => {
        const view = viewHearing(records.hearings[0], records, new Date("2026-11-10T10:01:30Z"));
        expect(view).toMatchObject({ state: "in_progress", done: 1, total: 2, started: true });
        expect(view.cases.map((item) => item.position)).toEqual([1, 2]);
        expect(view.overtime).toBe(false);
        expect(view.remainingSeconds).toBeGreaterThan(0);
    });

    it("flags a hearing that outlasts the quoted time", () => {
        const late = viewHearing(records.hearings[0], records, new Date("2026-11-10T10:05:00Z"));
        expect(late.overtime).toBe(true);
        expect(late.remainingSeconds).toBe(0);
    });

    it("lists newest first, can scope to an agent, and knows when one is in session", () => {
        expect(viewHearings(records, NOW).map((view) => view.hearing.id)).toEqual(["h1", "h0"]);
        expect(viewHearings(records, NOW, "00000000-0000-4000-8000-000000000024")).toEqual([]);
        expect(anyInSession(records, NOW)).toBe(true);
        expect(anyInSession({ ...records, events: records.events.filter((item) => item.hearing_id !== "h1") }, new Date("2026-11-12T00:00:00Z"))).toBe(false);
    });

    it("keeps the launch failure reason only for failed hearings", () => {
        const failed = viewHearing(records.hearings[1], { ...records, events: [event("h0", "failed", "2026-11-09T10:03:00Z", "launch: boom")] }, NOW);
        expect(failed).toMatchObject({ state: "failed", failedDetail: "launch: boom" });
        expect(viewHearing(records.hearings[1], records, NOW).failedDetail).toBeUndefined();
    });

    it("counts the judge's verdicts", () => {
        expect(scoreboard([verdict("h", "a", "correct"), verdict("h", "b", "incorrect"), verdict("h", "c", "incorrect"), verdict("h", "d", "unclear")])).toEqual({
            correct: 1,
            incorrect: 2,
            unclear: 1,
        });
    });
});
