import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { HearingCaseLink, HumanVerdict, ReviewReason, ReviewRecord, ReviewRecords } from "@/rules/case-validity";
import type { TrustHearing, TrustVerdict } from "@/rules/judge-trust";
import { readAllPages } from "./pagination";
import { getSessionAuthor } from "./session-author";

type DataClient = Pick<AppRayfinClient, "data">;

/** Everything needed to apply R9 and to compute judge trust: verdicts, what each hearing asked, hearings and reviews. */
export interface ReviewData {
    reviewRecords: ReviewRecords;
    hearings: TrustHearing[];
    verdicts: TrustVerdict[];
}

export const EMPTY_REVIEW_DATA: ReviewData = { reviewRecords: { verdicts: [], hearingCases: [], reviews: [] }, hearings: [], verdicts: [] };

export interface NewVerdictReview {
    verdictId: string;
    humanVerdict: HumanVerdict;
    reason?: ReviewReason;
    comment?: string;
}

const REVIEW_FIELDS = ["id", "verdict_id", "humanVerdict", "reason", "comment", "reviewerUserId", "reviewerEmail", "source", "createdAt"] as const;
// Whole-table reads in one parallel round, like the other records: the data API can't join them and each request has a fixed cost.
const PAGE = 1000;

export async function listReviews(client: DataClient): Promise<ReviewRecord[]> {
    return (await readAllPages((after) => {
        const query = client.data.VerdictReview.select([...REVIEW_FIELDS]).orderBy({ createdAt: "asc" }).first(PAGE);
        return (after ? query.after(after) : query).executePaginated();
    })) as ReviewRecord[];
}

export async function loadReviewData(client: DataClient): Promise<ReviewData> {
    const [verdicts, hearingCases, hearings, reviews] = await Promise.all([
        readAllPages((after) => {
            const query = client.data.Verdict.select(["id", "hearing_id", "case_id", "judgeVerdict", "createdAt"]).orderBy({ createdAt: "asc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        readAllPages((after) => {
            const query = client.data.HearingCase.select(["id", "hearing_id", "case_id", "testimony_id"]).orderBy({ position: "asc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        readAllPages((after) => {
            const query = client.data.Hearing.select(["id", "agent_id", "criticPromptVersion", "createdAt"]).orderBy({ createdAt: "asc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        listReviews(client),
    ]);
    return {
        reviewRecords: { verdicts: verdicts as TrustVerdict[], hearingCases: hearingCases as HearingCaseLink[], reviews },
        hearings: hearings as TrustHearing[],
        verdicts: verdicts as TrustVerdict[],
    };
}

/** The review always carries the signed-in user's own identity: the insert policy rejects anything else. */
export async function createVerdictReview(client: Pick<AppRayfinClient, "data" | "auth">, input: NewVerdictReview): Promise<ReviewRecord> {
    const reviewer = getSessionAuthor(client);
    const created = await client.data.VerdictReview.create({
        verdict_id: input.verdictId,
        humanVerdict: input.humanVerdict,
        reason: input.reason,
        comment: input.comment?.trim() || undefined,
        reviewerUserId: reviewer.userId,
        reviewerEmail: reviewer.email,
        createdAt: new Date(),
    });
    return created as ReviewRecord;
}
