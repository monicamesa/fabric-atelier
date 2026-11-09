import { describe, expect, it } from "vitest";
import {
    analyzeCase,
    caseEvents,
    countsForTestimony,
    currentVotes,
    findActiveJuror,
    getCaseState,
    isValidDismissal,
    isVerifiedCase,
    needsMyVote,
    type CaseDismissalRecord,
    type CaseRecord,
    type CaseRecords,
    type JurorRecord,
    type TestimonyRecord,
    type VoteRecord,
} from "./case-validity";
import { CONSENSUS_MIN_VOTES } from "./consensus";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const jurors: JurorRecord[] = [
    { email: "ana.expert@example.com", role: "expert", active: true },
    { email: "Bruno.Approver@example.com", role: "approver", active: true },
    { email: "carla.admin@example.com", role: "admin", active: true },
    { email: "dario.former@example.com", role: "admin", active: false },
    { email: "elena.expert@example.com", role: "expert", active: true },
    { email: "fran.approver@example.com", role: "approver", active: true },
];
const sub = (email: string) => `sub-${email.split(".")[0]}`;
const ANA = "ana.expert@example.com";
const BRUNO = "bruno.approver@example.com";
const CARLA = "carla.admin@example.com";
const DARIO = "dario.former@example.com";
const ELENA = "elena.expert@example.com";
const FRAN = "fran.approver@example.com";
const OUTSIDER = "eva.outsider@example.com";

const caseByJuror: CaseRecord = { id: "case-1", authorUserId: sub(ANA), authorEmail: ANA, createdAt: at(-60) };
const caseByOutsider: CaseRecord = { id: "case-2", authorUserId: sub(OUTSIDER), authorEmail: OUTSIDER, createdAt: at(-60) };

let sequence = 0;
function testimony(id: string, author: string, minutes = -50): TestimonyRecord {
    return { id, case_id: "case-1", authorUserId: sub(author), authorEmail: author, createdAt: at(minutes) };
}
function vote(testimonyId: string, voter: string, value: "for" | "against", minutes = -10, comment: string | null = value === "against" ? "Different period" : null): VoteRecord {
    sequence += 1;
    return { id: `v${String(sequence).padStart(3, "0")}`, testimony_id: testimonyId, value, comment, voterUserId: sub(voter), voterEmail: voter, createdAt: at(minutes) };
}
function dismissal(overrides: Partial<CaseDismissalRecord>): CaseDismissalRecord {
    return { id: "d1", case_id: "case-1", dismissedByUserId: "sub-other", dismissedByEmail: "other@example.com", createdAt: at(-5), ...overrides };
}
function records(parts: Partial<CaseRecords>): CaseRecords {
    return { caseRecord: caseByJuror, testimonies: [], votes: [], dismissals: [], jurors, now: NOW, ...parts };
}

const A = testimony("t-a", ANA);
const B = testimony("t-b", ELENA, -40);

describe("findActiveJuror and R7", () => {
    it("matches emails ignoring case and spaces, and ignores inactive jurors", () => {
        expect(findActiveJuror(jurors, "  bruno.approver@EXAMPLE.com ")?.role).toBe("approver");
        expect(findActiveJuror(jurors, DARIO)).toBeUndefined();
    });

    it("marks a case by someone who is not an active juror as unverified", () => {
        expect(isVerifiedCase(caseByJuror, jurors)).toBe(true);
        expect(isVerifiedCase(caseByOutsider, jurors)).toBe(false);
        expect(isVerifiedCase({ ...caseByJuror, authorEmail: DARIO }, jurors)).toBe(false);
    });

    it("ignores answers and votes from people who are not active jurors", () => {
        const outsiderAnswer = testimony("t-x", OUTSIDER);
        const analysis = analyzeCase(records({ testimonies: [outsiderAnswer, A], votes: [vote("t-x", BRUNO, "for"), vote("t-a", DARIO, "for")] }));
        expect(analysis.tallies.find((t) => t.testimony.id === "t-x")?.valid).toBe(false);
        expect(analysis.tallies.find((t) => t.testimony.id === "t-a")?.votesFor).toBe(0);
        expect(analysis.state).toBe("under_review");
    });
});

describe("R1 current votes", () => {
    it("keeps only each voter's latest vote per answer, whatever the reading order", () => {
        const first = vote("t-a", BRUNO, "for", -30);
        const second = vote("t-a", BRUNO, "against", -20);
        expect(currentVotes([second, first], NOW)).toEqual([second]);
        expect(currentVotes([first, second], NOW)).toEqual([second]);
    });

    it("breaks equal timestamps by id", () => {
        const a = { ...vote("t-a", BRUNO, "for", -10), id: "v-a" };
        const b = { ...vote("t-a", BRUNO, "against", -10), id: "v-b" };
        expect(currentVotes([b, a], NOW)).toEqual([b]);
    });

    it("ignores votes dated more than 5 minutes in the future (D13)", () => {
        const honest = vote("t-a", BRUNO, "for", -10);
        const forged = vote("t-a", BRUNO, "against", 60);
        expect(currentVotes([honest, forged], NOW)).toEqual([honest]);
        expect(currentVotes([vote("t-a", ELENA, "for", 4)], NOW)).toHaveLength(1);
    });
});

describe("R2 and D4", () => {
    it("never counts the author's vote on their own answer", () => {
        expect(countsForTestimony(vote("t-a", ANA, "for"), A, jurors)).toBe(false);
    });

    it("ignores an against vote with an empty comment", () => {
        expect(countsForTestimony(vote("t-a", BRUNO, "against", -10, "  "), A, jurors)).toBe(false);
        expect(countsForTestimony(vote("t-a", BRUNO, "against", -10, "Wrong period"), A, jurors)).toBe(true);
    });
});

describe("R3 consensus threshold", () => {
    it("defaults to two votes", () => {
        expect(CONSENSUS_MIN_VOTES).toBe(2);
    });

    it.each([
        [1, [vote("t-a", BRUNO, "for")], "ruled"],
        [2, [vote("t-a", BRUNO, "for")], "under_review"],
        [2, [vote("t-a", BRUNO, "for"), vote("t-a", ELENA, "for")], "ruled"],
        [3, [vote("t-a", BRUNO, "for"), vote("t-a", ELENA, "for")], "under_review"],
        [3, [vote("t-a", BRUNO, "for"), vote("t-a", ELENA, "for"), vote("t-a", CARLA, "for")], "ruled"],
    ] as const)("with n = %i rules only with enough votes", (minVotes, votes, state) => {
        expect(getCaseState(records({ testimonies: [A], votes: [...votes], minVotes }))).toBe(state);
    });

    it("needs at least one approver", () => {
        const analysis = analyzeCase(records({ testimonies: [A], votes: [vote("t-a", ELENA, "for"), vote("t-a", CARLA, "for")] }));
        expect(analysis.state).toBe("under_review");
        expect(analysis.reason).toBe("needsApprover");
    });

    it("never treats an admin as an approver (D11)", () => {
        expect(getCaseState(records({ testimonies: [A], votes: [vote("t-a", CARLA, "for"), vote("t-a", ELENA, "for")] }))).toBe("under_review");
    });

    it("is not ruled while an approver's against vote stands", () => {
        const votes = [vote("t-a", BRUNO, "for"), vote("t-a", ELENA, "for"), vote("t-a", FRAN, "against")];
        expect(getCaseState(records({ testimonies: [A], votes }))).toBe("disputed");
        const withoutApproverFor = [vote("t-a", ELENA, "for"), vote("t-a", CARLA, "for"), vote("t-a", FRAN, "against")];
        expect(analyzeCase(records({ testimonies: [A], votes: withoutApproverFor })).reason).toBe("approverAgainst");
    });

    it("reports how many votes are missing", () => {
        expect(analyzeCase(records({ testimonies: [A], votes: [vote("t-a", BRUNO, "for")] })).votesMissing).toBe(1);
        expect(analyzeCase(records({ testimonies: [A] })).votesMissing).toBe(2);
    });
});

describe("R4 dispute", () => {
    it("is disputed when two answers have valid support", () => {
        const analysis = analyzeCase(records({ testimonies: [A, B], votes: [vote("t-a", BRUNO, "for"), vote("t-b", FRAN, "for")] }));
        expect(analysis.state).toBe("disputed");
        expect(analysis.reason).toBe("competingAnswers");
    });

    it("is disputed when approvers split on one answer", () => {
        const analysis = analyzeCase(records({ testimonies: [A], votes: [vote("t-a", BRUNO, "for"), vote("t-a", FRAN, "against")] }));
        expect(analysis.reason).toBe("approverSplit");
    });

    it("does not count support from the answer's own author as competition", () => {
        expect(getCaseState(records({ testimonies: [A, B], votes: [vote("t-a", BRUNO, "for"), vote("t-b", ELENA, "for")] }))).toBe("under_review");
    });
});

describe("R8 dismissal and state priority", () => {
    it("accepts the author or an active admin, and ignores anyone else", () => {
        expect(isValidDismissal(dismissal({ dismissedByUserId: sub(ANA) }), caseByJuror, jurors)).toBe(true);
        expect(isValidDismissal(dismissal({ dismissedByEmail: CARLA }), caseByJuror, jurors)).toBe(true);
        expect(isValidDismissal(dismissal({ dismissedByEmail: DARIO }), caseByJuror, jurors)).toBe(false);
        expect(isValidDismissal(dismissal({ dismissedByEmail: BRUNO }), caseByJuror, jurors)).toBe(false);
        expect(isValidDismissal(dismissal({ case_id: "case-2", dismissedByUserId: sub(ANA) }), caseByJuror, jurors)).toBe(false);
    });

    it("puts dismissed above disputed and ruled", () => {
        const votes = [vote("t-a", BRUNO, "for"), vote("t-b", FRAN, "for")];
        expect(getCaseState(records({ testimonies: [A, B], votes, dismissals: [dismissal({ dismissedByUserId: sub(ANA) })] }))).toBe("dismissed");
    });

    it("ignores a future-dated dismissal", () => {
        expect(getCaseState(records({ testimonies: [A], dismissals: [dismissal({ dismissedByUserId: sub(ANA), createdAt: at(30) })] }))).toBe("under_review");
    });

    it("is under review with no answers", () => {
        expect(analyzeCase(records({})).reason).toBe("noAnswers");
    });
});

describe("needsMyVote (D5)", () => {
    const me = { userId: sub(ELENA), email: ELENA };

    it("asks for my vote on an open case with someone else's answer", () => {
        const parts = records({ testimonies: [A] });
        expect(needsMyVote(parts, analyzeCase(parts), me)).toBe(true);
    });

    it("stops asking once I have voted, or when the only answer is mine", () => {
        const voted = records({ testimonies: [A], votes: [vote("t-a", ELENA, "for")] });
        expect(needsMyVote(voted, analyzeCase(voted), me)).toBe(false);
        const mine = records({ testimonies: [testimony("t-e", ELENA)] });
        expect(needsMyVote(mine, analyzeCase(mine), me)).toBe(false);
    });

    it("also asks admins, and never non-jurors or for closed or unverified cases", () => {
        const parts = records({ testimonies: [A] });
        expect(needsMyVote(parts, analyzeCase(parts), { userId: sub(CARLA), email: CARLA })).toBe(true);
        expect(needsMyVote(parts, analyzeCase(parts), { userId: "sub-eva", email: OUTSIDER })).toBe(false);
        const unverified = records({ caseRecord: caseByOutsider, testimonies: [{ ...A, case_id: "case-2" }] });
        expect(needsMyVote(unverified, analyzeCase(unverified), me)).toBe(false);
    });
});

describe("caseEvents (court record)", () => {
    it("replays ruled, then disputed, from the records in order", () => {
        const votes = [vote("t-a", BRUNO, "for", -30), vote("t-a", ELENA, "for", -20), vote("t-b", FRAN, "for", -5)];
        const events = caseEvents(records({ testimonies: [A, testimony("t-b", CARLA, -10)], votes }));
        expect(events.filter((event) => event.kind === "state").map((event) => event.kind === "state" && event.state)).toEqual(["ruled", "disputed"]);
        expect(events[0].kind).toBe("proposed");
    });

    it("lists future-dated records but never lets them change the state", () => {
        const events = caseEvents(records({ testimonies: [A], votes: [vote("t-a", BRUNO, "for", -10), vote("t-a", ELENA, "for", 90)] }));
        const forged = events.find((event) => event.kind === "vote" && event.futureDated);
        expect(forged).toBeDefined();
        expect(events.some((event) => event.kind === "state")).toBe(false);
    });
});
