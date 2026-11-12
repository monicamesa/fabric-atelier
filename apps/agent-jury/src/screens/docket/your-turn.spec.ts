import { describe, expect, it } from "vitest";
import { buildDocket, type Docket, type DocketRecords } from "@/data/docket";
import { EMPTY_REVIEW_DATA, type ReviewData } from "@/data/reviews.service";
import type { JurorRecord, JurorRole } from "@/rules/case-validity";
import type { TurnContext } from "./next-step";
import { gameProgress, hearingMayBeBusy, MAX_TURN_LINES, yourTurn } from "./your-turn";

const NOW = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const PEOPLE = {
    ana: { email: "ana.expert@example.com", role: "expert" as JurorRole },
    bruno: { email: "bruno.approver@example.com", role: "approver" as JurorRole },
    elena: { email: "elena.expert@example.com", role: "expert" as JurorRole },
    dario: { email: "dario.admin@example.com", role: "admin" as JurorRole },
};
type Person = keyof typeof PEOPLE;
const jurors: JurorRecord[] = Object.values(PEOPLE).map((person) => ({ email: person.email, role: person.role, active: true }));
const userId = (person: Person) => `sub-${person}`;
const ctxFor = (person: Person): TurnContext & { isAdmin: boolean } => ({
    me: { userId: userId(person), email: PEOPLE[person].email },
    canAct: true,
    role: PEOPLE[person].role,
    isAdmin: PEOPLE[person].role === "admin",
});

const caseRow = (id: string, author: Person) => ({
    id,
    agent_id: "agent-1",
    text: `Question ${id}`,
    category: "Sales",
    authorUserId: userId(author),
    authorEmail: PEOPLE[author].email,
    createdAt: at(-120),
});
const answer = (id: string, caseId: string, author: Person) => ({
    id,
    case_id: caseId,
    answer: id,
    definition: "Definition",
    authorUserId: userId(author),
    authorEmail: PEOPLE[author].email,
    createdAt: at(-110),
});
const vote = (id: string, testimonyId: string, voter: Person) => ({
    id,
    testimony_id: testimonyId,
    value: "for" as const,
    comment: null,
    voterUserId: userId(voter),
    voterEmail: PEOPLE[voter].email,
    createdAt: at(-60),
});

function docketFor(person: Person, records: Partial<DocketRecords>, reviews?: ReviewData): Docket {
    return buildDocket({ cases: [], testimonies: [], votes: [], dismissals: [], ...records, reviews }, jurors, { userId: userId(person), email: PEOPLE[person].email }, NOW, "agent-1");
}
const options = { reviewsAvailable: true, now: NOW };

// c1 open (ana's), c2 open with an expert vote (ana's), c3 disputed, c4 ruled and never judged, c5 ruled and judged.
const cases = ["c1", "c2", "c3", "c4", "c5"].map((id) => caseRow(id, id === "c3" ? "bruno" : "ana"));
const records: Partial<DocketRecords> = {
    cases,
    testimonies: [
        answer("t1", "c1", "ana"),
        answer("t2", "c2", "ana"),
        answer("t3a", "c3", "bruno"),
        answer("t3b", "c3", "dario"),
        answer("t4", "c4", "ana"),
        answer("t5", "c5", "ana"),
    ],
    votes: [
        vote("v2", "t2", "dario"),
        vote("v3a", "t3a", "elena"),
        vote("v3b", "t3b", "elena"),
        vote("v4a", "t4", "bruno"),
        vote("v4b", "t4", "elena"),
        vote("v5a", "t5", "bruno"),
        vote("v5b", "t5", "elena"),
    ],
};
const judged: ReviewData = {
    ...EMPTY_REVIEW_DATA,
    reviewRecords: {
        verdicts: [{ id: "vd5", hearing_id: "h1", case_id: "c5", judgeVerdict: "correct" }],
        hearingCases: [{ hearing_id: "h1", case_id: "c5", testimony_id: "t5" }],
        reviews: [],
    },
    hearings: [{ id: "h1", agent_id: "agent-1", createdAt: at(-5) }],
    verdicts: [{ id: "vd5", hearing_id: "h1", case_id: "c5", judgeVerdict: "correct" }],
};

describe("yourTurn", () => {
    it("shows an approver the cases where only their vote is missing first, then disputes and reviews", () => {
        const turn = yourTurn(docketFor("bruno", records, judged).cases, ctxFor("bruno"), options);
        expect(turn.lines.map((line) => line.key)).toEqual(["approverVote", "disputed", "review"]);
        expect(turn.lines[0]).toMatchObject({ count: 2, caseId: "c1" });
    });

    it("counts cases waiting for a juror's vote and links to the first, never the ones they wrote", () => {
        const turn = yourTurn(docketFor("elena", records, judged).cases, ctxFor("elena"), options);
        const vote = turn.lines.find((line) => line.key === "vote");
        expect(vote).toMatchObject({ count: 2, caseId: "c1" });
        expect(turn.lines.find((line) => line.key === "approverVote")).toBeUndefined();
    });

    it("asks for an opinion on disputed cases the juror has not voted on", () => {
        const turn = yourTurn(docketFor("ana", records, judged).cases, ctxFor("ana"), options);
        expect(turn.lines.find((line) => line.key === "disputed")).toMatchObject({ count: 1, caseId: "c3" });
        expect(turn.lines.find((line) => line.key === "vote")).toBeUndefined();
    });

    it("asks for the review of judge verdicts, linked to the hearing", () => {
        const turn = yourTurn(docketFor("elena", records, judged).cases, ctxFor("elena"), options);
        expect(turn.lines.find((line) => line.key === "review")).toMatchObject({ count: 1, hearingId: "h1" });
    });

    it("tells an admin how many ruled cases are ready for a hearing, and only an admin", () => {
        const admin = yourTurn(docketFor("dario", records, judged).cases, ctxFor("dario"), options);
        expect(admin.lines.find((line) => line.key === "hearing")).toMatchObject({ count: 1, caseId: "c4" });
        const expert = yourTurn(docketFor("ana", records, judged).cases, ctxFor("ana"), options);
        expect(expert.lines.find((line) => line.key === "hearing")).toBeUndefined();
    });

    it("warns an admin when a hearing started recently, and not when it was long ago", () => {
        const recent = yourTurn(docketFor("dario", records, judged).cases, ctxFor("dario"), { ...options, latestHearingAt: at(-5) });
        expect(recent.hearingMayBeBusy).toBe(true);
        const old = yourTurn(docketFor("dario", records, judged).cases, ctxFor("dario"), { ...options, latestHearingAt: at(-24 * 60) });
        expect(old.hearingMayBeBusy).toBe(false);
        expect(hearingMayBeBusy(undefined, NOW)).toBe(false);
    });

    it("is up to date when nothing is pending", () => {
        const proposedByAna = { cases: [caseRow("c1", "ana")], testimonies: [answer("t1", "c1", "ana")] };
        const turn = yourTurn(docketFor("ana", proposedByAna).cases, ctxFor("ana"), options);
        expect(turn).toMatchObject({ lines: [], upToDate: true });
    });

    it("shows at most four lines", () => {
        const turn = yourTurn(docketFor("bruno", records, judged).cases, { ...ctxFor("bruno"), isAdmin: true }, options);
        expect(turn.lines.length).toBeLessThanOrEqual(MAX_TURN_LINES);
    });

    it("hides what depends on reviews when they could not be read", () => {
        const turn = yourTurn(docketFor("dario", records, judged).cases, ctxFor("dario"), { ...options, reviewsAvailable: false });
        expect(turn.lines.map((line) => line.key)).not.toEqual(expect.arrayContaining(["review", "hearing"]));
    });

    it("gives nothing to someone who cannot act", () => {
        const visitor = { me: { userId: "sub-visitor", email: "visitor@example.com" }, canAct: false, isAdmin: false };
        expect(yourTurn(docketFor("ana", records).cases, visitor, options)).toEqual({ lines: [], upToDate: false, hearingMayBeBusy: false });
    });
});

describe("gameProgress", () => {
    it("counts each stage and marks where most work is waiting", () => {
        const progress = gameProgress(docketFor("ana", records, judged).cases, true);
        const count = (stage: string) => progress.stages.find((item) => item.stage === stage);
        expect(count("propose")?.count).toBe(5);
        expect(count("vote")).toMatchObject({ count: 3, waiting: 3 });
        expect(count("ruled")?.count).toBe(2);
        expect(count("hearing")).toMatchObject({ count: 1, waiting: 1 });
        expect(count("review")).toMatchObject({ count: 0, waiting: 1 });
        expect(progress.bottleneck).toBe("vote");
    });

    it("has no bottleneck when nothing waits", () => {
        const progress = gameProgress([], true);
        expect(progress.bottleneck).toBeUndefined();
    });

    it("leaves out the hearing and review stages when reviews could not be read", () => {
        expect(gameProgress(docketFor("ana", records).cases, false).stages.map((item) => item.stage)).toEqual(["propose", "vote", "ruled"]);
    });
});
