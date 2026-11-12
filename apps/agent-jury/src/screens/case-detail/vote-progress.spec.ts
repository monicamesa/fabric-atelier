import { describe, expect, it } from "vitest";
import type { TestimonyTally } from "@/rules/case-validity";
import { leadingNeedsApprover, stillNeeded } from "./vote-progress";

const tally = (over: Partial<TestimonyTally>) => ({ testimony: {}, valid: true, votesFor: 0, votesAgainst: 0, approverFor: 0, approverAgainst: 0, ...over }) as TestimonyTally;

describe("stillNeeded", () => {
    it("asks for more votes and an approver when nothing is in yet", () => {
        expect(stillNeeded(tally({}), 2)).toEqual({ key: "needsMoreApprover", count: 2 });
    });

    it("asks for more votes, with an approver, after one expert vote", () => {
        expect(stillNeeded(tally({ votesFor: 1 }), 2)).toEqual({ key: "needsMoreApprover", count: 1 });
    });

    it("asks only for votes once an approver is in", () => {
        expect(stillNeeded(tally({ votesFor: 1, approverFor: 1 }), 2)).toEqual({ key: "needsMore", count: 1 });
    });

    it("asks only for an approver when the votes are enough", () => {
        expect(stillNeeded(tally({ votesFor: 2 }), 2)).toEqual({ key: "enoughNeedsApprover", count: 0 });
    });

    it("says nothing when it is ready to rule, blocked by an approver, or not eligible", () => {
        expect(stillNeeded(tally({ votesFor: 2, approverFor: 1 }), 2)).toBeUndefined();
        expect(stillNeeded(tally({ votesFor: 1, approverAgainst: 1 }), 2)).toBeUndefined();
        expect(stillNeeded(tally({ valid: false }), 2)).toBeUndefined();
    });
});

describe("leadingNeedsApprover", () => {
    it("is true only while no approver has voted for or against the leading answer", () => {
        expect(leadingNeedsApprover(tally({ votesFor: 1 }))).toBe(true);
        expect(leadingNeedsApprover(tally({ votesFor: 1, approverFor: 1 }))).toBe(false);
        expect(leadingNeedsApprover(tally({ approverAgainst: 1 }))).toBe(false);
        expect(leadingNeedsApprover(undefined)).toBe(false);
    });
});
