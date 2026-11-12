import type { DocketCase } from "@/data/docket";
import type { JurorRole, Me, TestimonyTally } from "@/rules/case-validity";

/** Who is asking: the signed-in person and, if they are an active juror, their role. */
export interface TurnContext {
    me?: Me;
    /** Only active jurors act (D2). */
    canAct: boolean;
    role?: JurorRole;
}

export type NextStepKey =
    | "dismissed"
    | "noAnswers"
    | "yourVote"
    | "yourApproverVote"
    | "proposedWaiting"
    | "waitingApprover"
    | "waitingVotes"
    | "waitingVotesApprover"
    | "approverAgainst"
    | "reopened"
    | "disputedYourOpinion"
    | "disputedWaiting"
    | "readyForHearing"
    | "reviewVerdict"
    | "judged";

export interface NextStep {
    key: NextStepKey;
    count?: number;
    /** True when the ball is in this person's court. */
    yours: boolean;
}

/** Verdicts of this case that the person has not reviewed yet. */
export function unreviewedVerdicts(item: DocketCase, me: Me | undefined) {
    const records = item.records.reviewRecords;
    if (!records || !me) return [];
    return records.verdicts.filter((verdict) => !records.reviews.some((review) => review.verdict_id === verdict.id && review.reviewerUserId === me.userId));
}

function leadingTally(item: DocketCase): TestimonyTally | undefined {
    return [...item.analysis.tallies].filter((tally) => tally.valid).sort((a, b) => b.votesFor - a.votesFor)[0];
}

/** True while no approver has voted for or against the leading answer, so ruling still needs one. */
export function approverStillNeeded(item: DocketCase): boolean {
    const leading = leadingTally(item);
    return Boolean(leading && leading.approverFor === 0 && leading.approverAgainst === 0);
}

/** What happens next for THIS person on this case (not just the case's status). */
export function nextStep(item: DocketCase, ctx: TurnContext): NextStep {
    const { analysis } = item;
    const isApprover = ctx.canAct && ctx.role === "approver";

    if (analysis.state === "dismissed") return { key: "dismissed", yours: false };

    if (analysis.state === "ruled") {
        const toReview = ctx.canAct ? unreviewedVerdicts(item, ctx.me).length : 0;
        if (toReview > 0) return { key: "reviewVerdict", count: toReview, yours: true };
        const judged = (item.records.reviewRecords?.verdicts.length ?? 0) > 0;
        return { key: judged ? "judged" : "readyForHearing", yours: false };
    }

    if (analysis.state === "disputed") {
        return item.needsMyVote ? { key: "disputedYourOpinion", yours: true } : { key: "disputedWaiting", yours: false };
    }

    if (analysis.reason === "noAnswers") return { key: "noAnswers", yours: ctx.canAct };
    if (item.needsMyVote) return { key: isApprover && approverStillNeeded(item) ? "yourApproverVote" : "yourVote", yours: true };
    if (item.proposedByMe) return { key: "proposedWaiting", yours: false };

    switch (analysis.reason) {
        case "needsApprover":
            return { key: "waitingApprover", yours: false };
        case "approverAgainst":
            return { key: "approverAgainst", yours: false };
        case "reopened":
            return { key: "reopened", yours: false };
        default:
            return approverStillNeeded(item)
                ? { key: "waitingVotesApprover", count: analysis.votesMissing, yours: false }
                : { key: "waitingVotes", count: analysis.votesMissing, yours: false };
    }
}
