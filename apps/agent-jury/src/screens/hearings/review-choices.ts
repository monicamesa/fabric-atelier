import type { HumanVerdict, JudgeVerdict, ReviewReason } from "@/rules/case-validity";

export const REVIEW_REASONS: ReviewReason[] = ["judge_too_strict", "judge_too_lenient", "expected_answer_wrong", "other"];

/** What agreeing with the judge means as a human verdict. */
export function agreementFor(judge: JudgeVerdict): HumanVerdict {
    return judge === "unclear" ? "ambiguous" : judge;
}

/** An appeal says something different from the judge, so those are the only choices. */
export function appealChoices(judge: JudgeVerdict): HumanVerdict[] {
    return (["correct", "incorrect", "ambiguous"] as const).filter((choice) => choice !== agreementFor(judge));
}

export interface AppealInput {
    humanVerdict: HumanVerdict;
    reason: ReviewReason;
    comment: string;
}
