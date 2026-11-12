import { describe, expect, it } from "vitest";
import { buildDocket, type Docket, type DocketCase, type DocketRecords } from "@/data/docket";
import { EMPTY_REVIEW_DATA, type ReviewData } from "@/data/reviews.service";
import type { JurorRecord, JurorRole, ReviewRecord } from "@/rules/case-validity";
import { nextStep, type TurnContext } from "./next-step";

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
const ctxFor = (person: Person): TurnContext => ({ me: { userId: userId(person), email: PEOPLE[person].email }, canAct: true, role: PEOPLE[person].role });

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
const vote = (id: string, testimonyId: string, voter: Person, value: "for" | "against" = "for") => ({
    id,
    testimony_id: testimonyId,
    value,
    comment: value === "against" ? "Wrong definition" : null,
    voterUserId: userId(voter),
    voterEmail: PEOPLE[voter].email,
    createdAt: at(-60),
});

function docketFor(person: Person, records: Partial<DocketRecords>, reviews?: ReviewData): Docket {
    const raw: DocketRecords = { cases: [], testimonies: [], votes: [], dismissals: [], ...records, reviews };
    return buildDocket(raw, jurors, { userId: userId(person), email: PEOPLE[person].email }, NOW, "agent-1");
}
const only = (docket: Docket): DocketCase => docket.cases[0];

const proposed = { cases: [caseRow("c1", "ana")], testimonies: [answer("t1", "c1", "ana")] };

describe("nextStep for an open case", () => {
    it("tells the author they are waiting for others", () => {
        expect(nextStep(only(docketFor("ana", proposed)), ctxFor("ana"))).toMatchObject({ key: "proposedWaiting", yours: false });
    });

    it("tells another juror their vote is needed", () => {
        expect(nextStep(only(docketFor("elena", proposed)), ctxFor("elena"))).toMatchObject({ key: "yourVote", yours: true });
    });

    it("tells an approver their approver vote is needed", () => {
        expect(nextStep(only(docketFor("bruno", proposed)), ctxFor("bruno"))).toMatchObject({ key: "yourApproverVote", yours: true });
    });

    it("treats an admin as a voter: their vote is needed like an expert's", () => {
        expect(nextStep(only(docketFor("dario", proposed)), ctxFor("dario"))).toMatchObject({ key: "yourVote", yours: true });
    });

    it("says how many votes are missing, and that one must come from an approver, once you have voted", () => {
        const records = { ...proposed, votes: [vote("v1", "t1", "elena")] };
        expect(nextStep(only(docketFor("elena", records)), ctxFor("elena"))).toMatchObject({ key: "waitingVotesApprover", count: 1, yours: false });
    });

    it("says only the votes are missing once an approver has voted", () => {
        const records = { ...proposed, votes: [vote("v1", "t1", "bruno")] };
        expect(nextStep(only(docketFor("bruno", records)), ctxFor("bruno"))).toMatchObject({ key: "waitingVotes", count: 1, yours: false });
        expect(nextStep(only(docketFor("elena", records)), ctxFor("elena"))).toMatchObject({ key: "yourVote", yours: true });
    });

    it("waits for an approver when there are enough votes and none is from an approver", () => {
        const records = { ...proposed, votes: [vote("v1", "t1", "elena"), vote("v2", "t1", "dario")] };
        expect(nextStep(only(docketFor("elena", records)), ctxFor("elena"))).toMatchObject({ key: "waitingApprover", yours: false });
        expect(nextStep(only(docketFor("bruno", records)), ctxFor("bruno"))).toMatchObject({ key: "yourApproverVote", yours: true });
    });

    it("tells the author to add an answer when the case has none", () => {
        expect(nextStep(only(docketFor("ana", { cases: [caseRow("c1", "ana")] })), ctxFor("ana"))).toMatchObject({ key: "noAnswers" });
    });

    it("says an approver voted against", () => {
        const records = { ...proposed, votes: [vote("v1", "t1", "bruno", "against")] };
        expect(nextStep(only(docketFor("elena", records)), ctxFor("elena"))).toMatchObject({ yours: true, key: "yourVote" });
        const voted = { ...records, votes: [...records.votes, vote("v2", "t1", "elena")] };
        expect(nextStep(only(docketFor("elena", voted)), ctxFor("elena"))).toMatchObject({ key: "approverAgainst", yours: false });
    });

    it("gives a read-only visitor no step of their own", () => {
        const visitor: TurnContext = { me: { userId: "sub-visitor", email: "visitor@example.com" }, canAct: false };
        const raw: DocketRecords = { ...proposed, votes: [], dismissals: [] };
        const docket = buildDocket(raw, jurors, visitor.me, NOW, "agent-1");
        expect(nextStep(only(docket), visitor)).toMatchObject({ key: "waitingVotesApprover", yours: false });
    });
});

describe("nextStep for a disputed case", () => {
    const disputed = {
        cases: [caseRow("c1", "ana")],
        testimonies: [answer("t1", "c1", "ana"), answer("t2", "c1", "bruno")],
        votes: [vote("v1", "t1", "dario"), vote("v2", "t2", "elena")],
    };

    it("asks someone who has not voted on the competing answers to give their opinion", () => {
        expect(only(docketFor("bruno", disputed)).analysis.state).toBe("disputed");
        expect(nextStep(only(docketFor("bruno", disputed)), ctxFor("bruno"))).toMatchObject({ key: "disputedYourOpinion", yours: true });
    });

    it("says the jury has to agree once you have voted", () => {
        expect(nextStep(only(docketFor("elena", disputed)), ctxFor("elena"))).toMatchObject({ key: "disputedWaiting", yours: false });
    });
});

describe("nextStep for a ruled case", () => {
    const ruled = { ...proposed, votes: [vote("v1", "t1", "bruno"), vote("v2", "t1", "elena")] };
    const verdictReviews = (reviews: ReviewRecord[]): ReviewData => ({
        ...EMPTY_REVIEW_DATA,
        reviewRecords: {
            verdicts: [{ id: "vd1", hearing_id: "h1", case_id: "c1", judgeVerdict: "correct" }],
            hearingCases: [{ hearing_id: "h1", case_id: "c1", testimony_id: "t1" }],
            reviews,
        },
        hearings: [{ id: "h1", agent_id: "agent-1", createdAt: at(-30) }],
        verdicts: [{ id: "vd1", hearing_id: "h1", case_id: "c1", judgeVerdict: "correct" }],
    });
    const review = (id: string, person: Person): ReviewRecord => ({
        id,
        verdict_id: "vd1",
        humanVerdict: "correct",
        reviewerUserId: userId(person),
        reviewerEmail: PEOPLE[person].email,
        createdAt: at(-20),
    });

    it("is ready for a hearing until a hearing has judged it", () => {
        expect(only(docketFor("dario", ruled)).analysis.state).toBe("ruled");
        expect(nextStep(only(docketFor("dario", ruled)), ctxFor("dario"))).toMatchObject({ key: "readyForHearing", yours: false });
    });

    it("asks jurors to review the judge's verdict after a hearing", () => {
        expect(nextStep(only(docketFor("elena", ruled, verdictReviews([]))), ctxFor("elena"))).toMatchObject({ key: "reviewVerdict", count: 1, yours: true });
    });

    it("has nothing left for someone who already reviewed the verdict", () => {
        expect(nextStep(only(docketFor("elena", ruled, verdictReviews([review("r1", "elena")]))), ctxFor("elena"))).toMatchObject({ key: "judged", yours: false });
        expect(nextStep(only(docketFor("bruno", ruled, verdictReviews([review("r1", "elena")]))), ctxFor("bruno"))).toMatchObject({ key: "reviewVerdict", yours: true });
    });
});

describe("nextStep for a dismissed case", () => {
    it("has no further step", () => {
        const records = {
            ...proposed,
            dismissals: [
                { id: "d1", case_id: "c1", reason: "Ambiguous", dismissedByUserId: userId("ana"), dismissedByEmail: PEOPLE.ana.email, createdAt: at(-10) },
            ],
        };
        expect(nextStep(only(docketFor("elena", records as unknown as Partial<DocketRecords>)), ctxFor("elena"))).toMatchObject({ key: "dismissed", yours: false });
    });
});
