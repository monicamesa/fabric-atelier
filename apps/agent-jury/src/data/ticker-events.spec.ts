import { describe, expect, it } from "vitest";
import type { CaseRecords, JurorRecord, TestimonyRecord, VoteRecord } from "@/rules/case-validity";
import { analyzeCase } from "@/rules/case-validity";
import { buildTicker, TICKER_MAX_ITEMS } from "./ticker-events";

// Example identities only.
const NOW = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const ANA = "ana.expert@example.com";
const BRUNO = "bruno.approver@example.com";
const ELENA = "elena.expert@example.com";
const OUTSIDER = "eva.outsider@example.com";
const jurors: JurorRecord[] = [
    { email: ANA, role: "expert", active: true },
    { email: BRUNO, role: "approver", active: true },
    { email: ELENA, role: "expert", active: true },
];
const sub = (email: string) => `sub-${email.split(".")[0]}`;

let sequence = 0;
function docketCase(id: string, minutesAgo: number, parts: { author?: string; testimonies?: TestimonyRecord[]; votes?: VoteRecord[]; dismissed?: boolean } = {}) {
    const author = parts.author ?? ANA;
    const record = { id, authorUserId: sub(author), authorEmail: author, createdAt: at(-minutesAgo), text: `Question ${id}` };
    const records: CaseRecords = {
        caseRecord: record,
        testimonies: parts.testimonies ?? [],
        votes: parts.votes ?? [],
        dismissals: parts.dismissed ? [{ id: `d-${id}`, case_id: id, dismissedByUserId: sub(author), dismissedByEmail: author, createdAt: at(-1) }] : [],
        jurors,
        now: NOW,
    };
    return { record, records, analysis: analyzeCase(records) };
}
const answer = (id: string, caseId: string, author: string, minutesAgo: number): TestimonyRecord => ({ id, case_id: caseId, authorUserId: sub(author), authorEmail: author, createdAt: at(-minutesAgo) });
const vote = (testimonyId: string, voter: string, minutesAgo: number, value: "for" | "against" = "for"): VoteRecord => ({
    id: `v${(sequence += 1)}`,
    testimony_id: testimonyId,
    value,
    comment: value === "against" ? "No" : null,
    voterUserId: sub(voter),
    voterEmail: voter,
    createdAt: at(-minutesAgo),
});

describe("buildTicker", () => {
    it("says NEW for a case waiting for votes, dated when it was proposed", () => {
        expect(buildTicker([docketCase("c-new", 30)])).toEqual([{ caseId: "c-new", caseText: "Question c-new", status: "new", at: at(-30) }]);
    });

    it("says RULED with how many jurors agree, dated when the last needed vote came in", () => {
        const c = docketCase("c-ruled", 600, {
            testimonies: [answer("t1", "c-ruled", ANA, 590)],
            votes: [vote("t1", ELENA, 300), vote("t1", BRUNO, 120)],
        });
        expect(buildTicker([c])[0]).toMatchObject({ status: "ruled", at: at(-120), agreed: 2, total: 2 });
    });

    it("counts the jurors who voted against, to say '2 of 3'", () => {
        const c = docketCase("c-split", 600, {
            testimonies: [answer("t1", "c-split", ANA, 590)],
            votes: [vote("t1", ELENA, 300), vote("t1", BRUNO, 200), vote("t1", "dario.expert@example.com", 100, "against")],
        });
        // The third juror is not active, so only the two valid votes count: all agree.
        expect(buildTicker([c])[0]).toMatchObject({ agreed: 2, total: 2 });
    });

    it("says DISPUTED when two answers have votes in favour", () => {
        const c = docketCase("c-disputed", 600, {
            testimonies: [answer("t1", "c-disputed", ANA, 590), answer("t2", "c-disputed", ELENA, 580)],
            votes: [vote("t1", BRUNO, 300), vote("t2", ANA, 100)],
        });
        expect(buildTicker([c])[0]).toMatchObject({ status: "disputed", at: at(-100) });
        expect(buildTicker([c])[0].agreed).toBeUndefined();
    });

    it("leaves out dismissed cases and cases by people who are not active jurors", () => {
        const events = buildTicker([docketCase("c-gone", 10, { dismissed: true }), docketCase("c-outsider", 10, { author: OUTSIDER }), docketCase("c-ok", 10)]);
        expect(events.map((event) => event.caseId)).toEqual(["c-ok"]);
    });

    it("orders newest first and keeps the 8 most recent", () => {
        const cases = Array.from({ length: 12 }, (_, i) => docketCase(`c${i}`, 100 - i * 5));
        const events = buildTicker(cases);
        expect(events).toHaveLength(TICKER_MAX_ITEMS);
        expect(events.map((event) => event.caseId)).toEqual(["c11", "c10", "c9", "c8", "c7", "c6", "c5", "c4"]);
        expect([...events].map((event) => event.at)).toEqual([...events].map((event) => event.at).sort().reverse());
    });

    it("has no news for an empty docket", () => {
        expect(buildTicker([])).toEqual([]);
    });
});

describe("buildTicker: the AI judge", () => {
    const ruled = () =>
        docketCase("c-judge", 600, { testimonies: [answer("t1", "c-judge", ANA, 590)], votes: [vote("t1", ELENA, 300), vote("t1", BRUNO, 120)] });
    const hearings = [
        { id: "h-old", agent_id: "agent-1", criticPromptVersion: null, createdAt: at(-200) },
        { id: "h-new", agent_id: "agent-1", criticPromptVersion: null, createdAt: at(-60) },
    ];
    const verdict = (id: string, hearing: string, judge: "correct" | "incorrect" | "unclear", minutes: number) => ({ id, hearing_id: hearing, case_id: "c-judge", judgeVerdict: judge, createdAt: at(minutes) });

    it("adds one line per case with the verdict of the latest hearing", () => {
        const events = buildTicker([ruled()], { hearings, verdicts: [verdict("v-old", "h-old", "correct", -190), verdict("v-new", "h-new", "incorrect", -50)], overruled: [] });
        expect(events.map((event) => event.status)).toEqual(["incorrect", "ruled"]);
        expect(events[0]).toMatchObject({ caseId: "c-judge", at: at(-50) });
    });

    it("says unclear for a verdict the judge could not decide", () => {
        const events = buildTicker([ruled()], { hearings, verdicts: [verdict("v1", "h-new", "unclear", -50)], overruled: [] });
        expect(events.map((event) => event.status)).toContain("unclear");
    });

    it("adds an 'overruled' line only for the latest verdict of a case", () => {
        const data = { hearings, verdicts: [verdict("v-old", "h-old", "correct", -190), verdict("v-new", "h-new", "correct", -50)] };
        expect(buildTicker([ruled()], { ...data, overruled: [{ verdictId: "v-new", caseId: "c-judge", at: at(-20) }] }).map((event) => event.status)).toEqual(["overruled", "correct", "ruled"]);
        expect(buildTicker([ruled()], { ...data, overruled: [{ verdictId: "v-old", caseId: "c-judge", at: at(-20) }] }).map((event) => event.status)).not.toContain("overruled");
    });

    it("leaves out verdicts of dismissed cases, and shows no judge line without judge data", () => {
        const dismissed = docketCase("c-judge", 600, { dismissed: true });
        expect(buildTicker([dismissed], { hearings, verdicts: [verdict("v1", "h-new", "correct", -50)], overruled: [] })).toEqual([]);
        expect(buildTicker([ruled()]).map((event) => event.status)).toEqual(["ruled"]);
    });

    it("still keeps only the 8 most recent lines", () => {
        const cases = Array.from({ length: 6 }, (_, i) => docketCase(`c${i}`, 100 - i));
        const verdicts = cases.map((item, i) => ({ id: `v${i}`, hearing_id: "h-new", case_id: item.record.id, judgeVerdict: "correct" as const, createdAt: at(-10 - i) }));
        expect(buildTicker(cases, { hearings, verdicts, overruled: [] })).toHaveLength(TICKER_MAX_ITEMS);
    });
});