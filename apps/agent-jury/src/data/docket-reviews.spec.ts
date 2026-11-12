import { describe, expect, it } from "vitest";
import type { JurorRecord } from "@/rules/case-validity";
import { buildDocket, type DocketRecords } from "./docket";
import type { CaseRow, TestimonyRow, VoteRow } from "./cases.service";

// R9 and judge trust through the docket (I3b). Example identities only.
const NOW = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const AGENT = "agent-1";
const jurors: JurorRecord[] = [
    { email: "ana.expert@example.com", role: "expert", active: true },
    { email: "bruno.approver@example.com", role: "approver", active: true },
    { email: "elena.expert@example.com", role: "expert", active: true },
];
const caseRow = { id: "case-1", agent_id: AGENT, text: "How many customers do we have in Spain?", category: "Customers", tags: null, authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: at(-600) } as unknown as CaseRow;
const testimony = { id: "t-141", case_id: "case-1", answer: "141", definition: "By billing country", authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: at(-590) } as unknown as TestimonyRow;
const vote = (id: string, who: string, minutes: number) => ({ id, testimony_id: "t-141", value: "for", comment: null, voterUserId: `sub-${who.split(".")[0]}`, voterEmail: who, createdAt: at(minutes) }) as unknown as VoteRow;

function records(withReview: boolean): DocketRecords {
    return {
        cases: [caseRow],
        testimonies: [testimony],
        votes: [vote("v1", "elena.expert@example.com", -300), vote("v2", "bruno.approver@example.com", -290)],
        dismissals: [],
        reviews: {
            hearings: [{ id: "h1", agent_id: AGENT, criticPromptVersion: null, createdAt: at(-100) }],
            verdicts: [{ id: "verdict-1", hearing_id: "h1", case_id: "case-1", judgeVerdict: "correct", createdAt: at(-90) }],
            reviewRecords: {
                verdicts: [{ id: "verdict-1", hearing_id: "h1", case_id: "case-1", judgeVerdict: "correct", createdAt: at(-90) }],
                hearingCases: [{ hearing_id: "h1", case_id: "case-1", testimony_id: "t-141" }],
                reviews: withReview
                    ? [
                          {
                              id: "r1",
                              verdict_id: "verdict-1",
                              humanVerdict: "incorrect",
                              reason: "expected_answer_wrong",
                              comment: "The business counts by shipping country.",
                              reviewerUserId: "sub-bruno",
                              reviewerEmail: "bruno.approver@example.com",
                              source: "seed",
                              createdAt: at(-30),
                          },
                      ]
                    : [],
            },
        },
    };
}

describe("buildDocket with reviews", () => {
    it("keeps a ruled case ruled without a review", () => {
        const docket = buildDocket(records(false), jurors, undefined, NOW, AGENT);
        expect(docket.cases[0].analysis.state).toBe("ruled");
    });

    it("reopens it when an approver challenges the expected answer (R9), even though the judge said correct", () => {
        const docket = buildDocket(records(true), jurors, undefined, NOW, AGENT);
        expect(docket.cases[0].analysis.state).toBe("under_review");
        expect(docket.cases[0].analysis.reason).toBe("reopened");
        expect(docket.cases[0].analysis.supersededVotes).toHaveLength(2);
    });

    it("computes judge trust for the agent, ignoring the seeded review", () => {
        const trust = buildDocket(records(true), jurors, undefined, NOW, AGENT).trust!;
        expect(trust.current).toMatchObject({ version: "default", decided: 0, unreviewed: 1 });
        expect(trust.overruled).toEqual([]);
        expect(buildDocket(records(true), jurors, undefined, NOW).trust).toBeUndefined();
    });

    it("puts a verdict the jury overruled on the ticker", () => {
        const data = records(true);
        data.reviews!.reviewRecords.reviews = [{ ...data.reviews!.reviewRecords.reviews[0], reason: "judge_too_lenient", source: null }];
        const docket = buildDocket(data, jurors, undefined, NOW, AGENT);
        expect(docket.trust!.current).toMatchObject({ agreed: 0, disagreed: 1 });
        expect(docket.trust!.overruled.map((item) => item.caseId)).toEqual(["case-1"]);
    });

    it("still works without review data", () => {
        const docket = buildDocket({ ...records(false), reviews: undefined }, jurors, undefined, NOW, AGENT);
        expect(docket.cases[0].analysis.state).toBe("ruled");
        expect(docket.trust?.current.decided).toBe(0);
    });
});
