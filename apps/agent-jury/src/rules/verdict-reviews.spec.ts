import { describe, expect, it } from "vitest";
import {
    analyzeCase,
    caseEvents,
    currentReviews,
    isAppeal,
    judgeAgrees,
    needsMyVote,
    reopenings,
    validReviews,
    type CaseRecords,
    type JurorRecord,
    type ReviewRecord,
    type ReviewRecords,
    type TestimonyRecord,
    type VerdictLink,
    type VoteRecord,
} from "./case-validity";

// R9 and the review rules (I3b). Fixtures use example.com identities only.
const NOW = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

const ANA = "ana.expert@example.com";
const BRUNO = "bruno.approver@example.com";
const CARLA = "carla.admin@example.com";
const ELENA = "elena.expert@example.com";
const FRAN = "fran.approver@example.com";
const GONE = "gone.approver@example.com";
const jurors: JurorRecord[] = [
    { email: ANA, role: "expert", active: true },
    { email: BRUNO, role: "approver", active: true },
    { email: CARLA, role: "admin", active: true },
    { email: ELENA, role: "expert", active: true },
    { email: FRAN, role: "approver", active: true },
    { email: GONE, role: "approver", active: false },
];
const sub = (email: string) => `sub-${email.split(".")[0]}`;

const caseRecord = { id: "case-1", authorUserId: sub(ANA), authorEmail: ANA, createdAt: at(-600) };
const t141: TestimonyRecord = { id: "t-141", case_id: "case-1", authorUserId: sub(ANA), authorEmail: ANA, createdAt: at(-590) };
const t265: TestimonyRecord = { id: "t-265", case_id: "case-1", authorUserId: sub(ELENA), authorEmail: ELENA, createdAt: at(-30) };

let sequence = 0;
const vote = (testimonyId: string, voter: string, minutes: number, value: "for" | "against" = "for"): VoteRecord => ({
    id: `v${String((sequence += 1)).padStart(3, "0")}`,
    testimony_id: testimonyId,
    value,
    comment: value === "against" ? "No" : null,
    voterUserId: sub(voter),
    voterEmail: voter,
    createdAt: at(minutes),
});
const review = (reviewer: string, minutes: number, parts: Partial<ReviewRecord> = {}): ReviewRecord => ({
    id: `r${String((sequence += 1)).padStart(3, "0")}`,
    verdict_id: "verdict-1",
    humanVerdict: "incorrect",
    reason: "expected_answer_wrong",
    comment: "The business counts by shipping country.",
    reviewerUserId: sub(reviewer),
    reviewerEmail: reviewer,
    createdAt: at(minutes),
    ...parts,
});

const verdict: VerdictLink = { id: "verdict-1", hearing_id: "hearing-1", case_id: "case-1", judgeVerdict: "correct", createdAt: at(-100) };
const link = { hearing_id: "hearing-1", case_id: "case-1", testimony_id: "t-141" };
const ruledVotes = [vote("t-141", ELENA, -300), vote("t-141", BRUNO, -290)];

function records(reviews: ReviewRecord[], parts: Partial<CaseRecords> = {}): CaseRecords {
    const reviewRecords: ReviewRecords = { verdicts: [verdict], hearingCases: [link], reviews };
    return { caseRecord, testimonies: [t141], votes: ruledVotes, dismissals: [], jurors, now: NOW, reviewRecords, ...parts };
}

describe("agreement with the judge", () => {
    it("matches equal verdicts, and a judge's unclear with a human ambiguous (D3)", () => {
        expect(judgeAgrees("correct", "correct")).toBe(true);
        expect(judgeAgrees("incorrect", "incorrect")).toBe(true);
        expect(judgeAgrees("unclear", "ambiguous")).toBe(true);
        expect(judgeAgrees("correct", "incorrect")).toBe(false);
        expect(judgeAgrees("correct", "ambiguous")).toBe(false);
        expect(judgeAgrees("unclear", "correct")).toBe(false);
        expect(judgeAgrees("incorrect", "ambiguous")).toBe(false);
    });

    it("calls a review that differs from the judge an appeal", () => {
        expect(isAppeal(review(BRUNO, 0), verdict)).toBe(true);
        expect(isAppeal(review(BRUNO, 0, { humanVerdict: "correct" }), verdict)).toBe(false);
    });
});

describe("review validity (R1 for reviews)", () => {
    it("keeps only the latest review of each reviewer for a verdict (D6) and drops future-dated ones", () => {
        const first = review(ANA, -20, { humanVerdict: "incorrect" });
        const second = review(ANA, -10, { humanVerdict: "correct", reason: null, comment: null });
        const forged = review(ANA, 600, { humanVerdict: "incorrect" });
        expect(currentReviews([first, second, forged], NOW)).toEqual([second]);
    });

    it("needs an active juror, and a comment when it is an appeal", () => {
        const records = { verdicts: [verdict], hearingCases: [link] } as const;
        const ok = review(BRUNO, -5);
        const inactive = review(GONE, -5);
        const outsider = review("eva.outsider@example.com", -5);
        const noComment = review(ELENA, -5, { comment: "   " });
        const agreeNoComment = review(FRAN, -5, { humanVerdict: "correct", reason: null, comment: null });
        const valid = validReviews({ ...records, reviews: [ok, inactive, outsider, noComment, agreeNoComment] }, jurors, NOW).map((item) => item.review.id);
        expect(valid).toEqual([ok.id, agreeNoComment.id]);
    });
});

describe("R9: a ruled case is reopened by an approver's expected_answer_wrong review", () => {
    it("is ruled until someone challenges the answer", () => {
        expect(analyzeCase(records([])).state).toBe("ruled");
        expect(analyzeCase(records([review(ANA, -5, { reason: "judge_too_strict" })])).state).toBe("ruled");
    });

    it("reopens even when the judge said correct", () => {
        expect(verdict.judgeVerdict).toBe("correct");
        const analysis = analyzeCase(records([review(BRUNO, -5)]));
        expect(analysis.state).toBe("under_review");
        expect(analysis.reason).toBe("reopened");
        expect(analysis.reopened).toMatchObject([{ testimonyId: "t-141", reviewerEmail: BRUNO }]);
        expect(analysis.rulingTestimonyId).toBeUndefined();
    });

    it("is not reopened by an expert, by an admin or by an inactive approver", () => {
        for (const who of [ANA, CARLA, GONE]) {
            expect(analyzeCase(records([review(who, -5)])).state, who).toBe("ruled");
        }
    });

    it("needs a comment, like any appeal", () => {
        expect(analyzeCase(records([review(BRUNO, -5, { comment: "" })])).state).toBe("ruled");
    });

    it("ignores a future-dated review", () => {
        expect(analyzeCase(records([review(BRUNO, 600)])).state).toBe("ruled");
    });

    it("keeps the earlier votes in the record but does not count them (D2)", () => {
        const analysis = analyzeCase(records([review(BRUNO, -5)]));
        expect(analysis.supersededVotes.map((item) => item.voterEmail).sort()).toEqual([BRUNO, ELENA].sort());
        expect(analysis.standingVotes).toEqual([]);
        expect(analysis.tallies[0]).toMatchObject({ votesFor: 0, approverFor: 0 });
    });

    it("asks the jurors who voted before to vote again", () => {
        const reopened = records([review(BRUNO, -5)], { testimonies: [t141, t265] });
        const analysis = analyzeCase(reopened);
        expect(needsMyVote(reopened, analysis, { userId: sub(ELENA), email: ELENA })).toBe(true); // voted before the review
        expect(needsMyVote(reopened, analysis, { userId: sub(FRAN), email: FRAN })).toBe(true);
        const again = records([review(BRUNO, -5)], { testimonies: [t141, t265], votes: [...ruledVotes, vote("t-265", FRAN, -3)] });
        expect(needsMyVote(again, analyzeCase(again), { userId: sub(FRAN), email: FRAN })).toBe(false); // voted after it
    });

    it("rules again when new votes approve the challenged answer again", () => {
        const again = [...ruledVotes, vote("t-141", ELENA, -3), vote("t-141", BRUNO, -2)];
        const analysis = analyzeCase(records([review(BRUNO, -5)], { votes: again }));
        expect(analysis.state).toBe("ruled");
        expect(analysis.rulingTestimonyId).toBe("t-141");
    });

    it("rules with the new answer when the new votes go to it, without turning disputed on the old votes", () => {
        const fresh = [...ruledVotes, vote("t-265", FRAN, -3), vote("t-265", CARLA, -2)];
        const analysis = analyzeCase(records([review(BRUNO, -5)], { testimonies: [t141, t265], votes: fresh }));
        expect(analysis.state).toBe("ruled");
        expect(analysis.rulingTestimonyId).toBe("t-265");
    });

    it("is disputed through the normal rules when the new votes split between answers", () => {
        const split = [...ruledVotes, vote("t-141", CARLA, -3), vote("t-265", FRAN, -2)];
        const analysis = analyzeCase(records([review(BRUNO, -5)], { testimonies: [t141, t265], votes: split }));
        expect(analysis.state).toBe("disputed");
        expect(analysis.reason).toBe("competingAnswers");
    });

    it("a newer challenge reopens the case again, and the latest review per testimony sets the cut-off", () => {
        const first = review(BRUNO, -5);
        const approvedAgain = [...ruledVotes, vote("t-141", ELENA, -4), vote("t-141", BRUNO, -3)];
        const second = review(FRAN, -2);
        expect(analyzeCase(records([first, second], { votes: approvedAgain })).state).toBe("under_review");
        expect(reopenings(records([first, second]).reviewRecords!, jurors, NOW, "case-1")).toMatchObject([{ reviewerEmail: FRAN }]);
    });

    it("applies to the case the verdict belongs to only", () => {
        const other = { ...verdict, id: "verdict-2", case_id: "case-2" };
        const elsewhere = review(BRUNO, -5, { verdict_id: "verdict-2" });
        const reviewRecords: ReviewRecords = { verdicts: [verdict, other], hearingCases: [link, { ...link, case_id: "case-2" }], reviews: [elsewhere] };
        expect(analyzeCase({ ...records([]), reviewRecords }).state).toBe("ruled");
    });

    it("never reopens without review records (older callers)", () => {
        expect(analyzeCase({ ...records([]), reviewRecords: undefined }).state).toBe("ruled");
    });

    it("counts a seeded review for R9 (source only matters to judge trust)", () => {
        expect(analyzeCase(records([review(BRUNO, -5, { source: "seed" })])).state).toBe("under_review");
    });
});

describe("court record with reviews", () => {
    it("shows the review, marks the earlier votes and replays the return to review", () => {
        const events = caseEvents(records([review(BRUNO, -5)]));
        const reviewEvent = events.find((event) => event.kind === "review");
        expect(reviewEvent).toMatchObject({ kind: "review", appeal: true, reopens: true, reason: "expected_answer_wrong", humanVerdict: "incorrect" });
        const votes = events.filter((event) => event.kind === "vote");
        expect(votes.every((event) => event.kind === "vote" && event.beforeReview)).toBe(true);
        expect(events.filter((event) => event.kind === "state").map((event) => event.kind === "state" && event.state)).toEqual(["ruled", "under_review"]);
    });

    it("does not mark votes cast after the review", () => {
        const events = caseEvents(records([review(BRUNO, -5)], { votes: [...ruledVotes, vote("t-141", FRAN, -3)] }));
        const flags = events.filter((event) => event.kind === "vote").map((event) => event.kind === "vote" && event.beforeReview);
        expect(flags).toEqual([true, true, false]);
    });
    it("flags a reopening review even when it agrees with the judge's verdict, so the record can say the answer was challenged", () => {
        const agreeingJudge = review(BRUNO, -5, { humanVerdict: "correct" });
        const events = caseEvents(records([agreeingJudge]));
        expect(events.find((event) => event.kind === "review")).toMatchObject({ appeal: false, reopens: true });
    });});
