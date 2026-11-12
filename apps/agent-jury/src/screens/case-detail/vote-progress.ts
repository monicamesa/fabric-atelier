import type { TestimonyTally } from "@/rules/case-validity";

export type NeedKey = "needsMoreApprover" | "needsMore" | "enoughNeedsApprover";

/**
 * What an answer still lacks to be ruled (R3: enough valid votes in favour, at least one from an approver, none against
 * from an approver). Undefined when nothing is missing, when the answer is not eligible (unverified author) or when an
 * approver already voted against it, because that blocks it and the case page says so separately.
 */
export function stillNeeded(tally: TestimonyTally, minVotes: number): { key: NeedKey; count: number } | undefined {
    if (!tally.valid || tally.approverAgainst > 0) return undefined;
    const count = Math.max(0, minVotes - tally.votesFor);
    const needsApprover = tally.approverFor === 0;
    if (count > 0) return { key: needsApprover ? "needsMoreApprover" : "needsMore", count };
    return needsApprover ? { key: "enoughNeedsApprover", count: 0 } : undefined;
}

/** True when the case-level "needs N more votes" line should also ask for an approver's vote. */
export function leadingNeedsApprover(leading: TestimonyTally | undefined): boolean {
    return Boolean(leading && leading.valid && leading.approverFor === 0 && leading.approverAgainst === 0);
}
