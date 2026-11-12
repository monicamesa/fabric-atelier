import { describe, expect, it } from "vitest";
import type { JurorRecord, ReviewRecord } from "./case-validity";
import { CRITIC_PROMPT, DEFAULT_CRITIC_PROMPT_VERSION, JUDGE_TRUST_MIN_DECIDED, criticPromptVersionOf, judgeTrust, type TrustHearing, type TrustVerdict } from "./judge-trust";

// The worked example of docs/iteraciones/I3b.md, section 4. Example identities only.
const NOW = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const ANA = "ana.expert@example.com";
const BETO = "beto.expert@example.com";
const BRUNO = "bruno.approver@example.com";
const GONE = "gone.expert@example.com";
const jurors: JurorRecord[] = [
    { email: ANA, role: "expert", active: true },
    { email: BETO, role: "expert", active: true },
    { email: BRUNO, role: "approver", active: true },
    { email: GONE, role: "expert", active: false },
];
const sub = (email: string) => `sub-${email.split(".")[0]}`;

const hearings: TrustHearing[] = [
    { id: "h1", agent_id: "agent-1", criticPromptVersion: null, createdAt: at(-2000) },
    { id: "h2", agent_id: "agent-1", criticPromptVersion: "v2", createdAt: at(-500) },
    { id: "h3", agent_id: "agent-2", criticPromptVersion: "v2", createdAt: at(-400) },
];
const verdict = (id: string, hearing: string, judgeVerdict: TrustVerdict["judgeVerdict"]): TrustVerdict => ({ id, hearing_id: hearing, case_id: `case-${id}`, judgeVerdict });
const verdicts: TrustVerdict[] = [
    verdict("V1", "h1", "correct"),
    verdict("V2", "h1", "incorrect"),
    verdict("V3", "h2", "correct"),
    verdict("V4", "h2", "incorrect"),
    verdict("V5", "h2", "incorrect"),
    verdict("V6", "h2", "correct"),
    verdict("V7", "h2", "unclear"),
    verdict("V8", "h2", "correct"),
    verdict("V9", "h2", "correct"),
    verdict("V10", "h2", "correct"),
    verdict("X1", "h3", "correct"),
];

let n = 0;
const review = (verdictId: string, reviewer: string, humanVerdict: ReviewRecord["humanVerdict"], parts: Partial<ReviewRecord> = {}): ReviewRecord => ({
    id: `r${(n += 1)}`,
    verdict_id: verdictId,
    humanVerdict,
    reason: null,
    comment: "Because.",
    reviewerUserId: sub(reviewer),
    reviewerEmail: reviewer,
    createdAt: at(-100 + n),
    ...parts,
});
const reviews: ReviewRecord[] = [
    review("V1", ANA, "correct"),
    review("V2", ANA, "correct"),
    review("V3", ANA, "correct"),
    review("V4", ANA, "incorrect"),
    review("V5", ANA, "correct"),
    review("V6", ANA, "correct"),
    review("V6", BETO, "incorrect"),
    review("V7", ANA, "ambiguous"),
    review("V8", BRUNO, "incorrect", { reason: "expected_answer_wrong" }),
    review("V9", BRUNO, "incorrect", { source: "seed" }),
    review("X1", ANA, "incorrect"),
];

const trust = (extra: Partial<Parameters<typeof judgeTrust>[0]> = {}) =>
    judgeTrust({ agentId: "agent-1", hearings, verdicts, reviewRecords: { verdicts, hearingCases: [], reviews }, jurors, now: NOW, currentVersion: "v2", ...extra });

describe("judge trust: the worked example", () => {
    it("scores the current critic-prompt version on its own", () => {
        expect(trust().current).toMatchObject({ version: "v2", current: true, agreed: 3, disagreed: 1, decided: 4, pending: 1, excluded: 1, unreviewed: 2, percent: 75, showPercent: false });
    });

    it("keeps an earlier version as history with its own numbers", () => {
        expect(trust().history).toMatchObject([{ version: "default", current: false, agreed: 1, disagreed: 1, decided: 2, percent: 50 }]);
    });

    it("counts per hearing, for the hearing page", () => {
        const { byHearing } = trust();
        expect(byHearing.h2).toMatchObject({ agreed: 3, disagreed: 1, pending: 1 });
        expect(byHearing.h1).toMatchObject({ agreed: 1, disagreed: 1 });
        expect(byHearing.h3).toBeUndefined();
    });

    it("is scoped per agent", () => {
        expect(trust({ agentId: "agent-2" }).current).toMatchObject({ version: "v2", decided: 1, disagreed: 1 });
    });

    it("lists the verdicts the jury overruled, for the ticker", () => {
        expect(trust().overruled.map((item) => item.verdictId).sort()).toEqual(["V2", "V5"]);
    });
});

describe("judge trust: rules", () => {
    it("ignores seeded reviews: a verdict with only seeded reviews is unreviewed", () => {
        const onlySeed = review("V10", ANA, "incorrect", { source: "seed" });
        const result = trust({ reviewRecords: { verdicts, hearingCases: [], reviews: [onlySeed] } });
        expect(result.current).toMatchObject({ agreed: 0, disagreed: 0, unreviewed: 8 });
    });

    it("never counts a seeded review even when it would change the majority", () => {
        const seeded = review("V3", BETO, "incorrect", { source: "seed" });
        const result = trust({ reviewRecords: { verdicts, hearingCases: [], reviews: [...reviews, seeded] } });
        expect(result.current.agreed).toBe(3);
    });

    it("lets the latest review of a reviewer replace the earlier one (D6)", () => {
        const changed = review("V3", ANA, "incorrect", { createdAt: at(-1) });
        expect(trust({ reviewRecords: { verdicts, hearingCases: [], reviews: [...reviews, changed] } }).current).toMatchObject({ agreed: 2, disagreed: 2 });
    });

    it("ignores reviews by inactive jurors and appeals without a comment", () => {
        const inactive = review("V10", GONE, "incorrect");
        const silent = review("V10", BETO, "incorrect", { comment: "" });
        expect(trust({ reviewRecords: { verdicts, hearingCases: [], reviews: [...reviews, inactive, silent] } }).current.disagreed).toBe(1);
    });

    it("decides by the majority of reviewers; an even split is pending and counts neither way", () => {
        const result = trust();
        expect(result.byHearing.h2.pending).toBe(1);
        const swing = review("V6", BRUNO, "correct");
        expect(trust({ reviewRecords: { verdicts, hearingCases: [], reviews: [...reviews, swing] } }).current).toMatchObject({ agreed: 4, pending: 0 });
    });

    it("shows the percentage only from the minimum number of decided verdicts, and never invents one", () => {
        expect(trust({ agentId: "nobody" }).current).toMatchObject({ decided: 0, percent: null, showPercent: false });
        const many = Array.from({ length: JUDGE_TRUST_MIN_DECIDED }, (_, i) => verdict(`M${i}`, "h2", "correct"));
        const agrees = many.map((item) => review(item.id, ANA, "correct"));
        const result = trust({ verdicts: many, reviewRecords: { verdicts: many, hearingCases: [], reviews: agrees } });
        expect(result.current).toMatchObject({ decided: JUDGE_TRUST_MIN_DECIDED, percent: 100, showPercent: true });
    });

    it("treats a hearing without a stored version as the default judge", () => {
        expect(criticPromptVersionOf({ criticPromptVersion: null })).toBe(DEFAULT_CRITIC_PROMPT_VERSION);
        expect(criticPromptVersionOf({ criticPromptVersion: "  " })).toBe(DEFAULT_CRITIC_PROMPT_VERSION);
        expect(criticPromptVersionOf({ criticPromptVersion: "v2" })).toBe("v2");
    });

    it("reports the current version even before it has any verdict, with earlier ones as history", () => {
        const result = trust({ currentVersion: "v3" });
        expect(result.current).toMatchObject({ version: "v3", decided: 0 });
        expect(result.history.map((item) => item.version)).toEqual(["v2", "default"]);
    });

    it("keeps the prompt text and its version together: a custom text needs its own version id", () => {
        expect(CRITIC_PROMPT.text === undefined || CRITIC_PROMPT.version !== DEFAULT_CRITIC_PROMPT_VERSION).toBe(true);
    });
});
