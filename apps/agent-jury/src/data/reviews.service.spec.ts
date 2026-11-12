import { describe, expect, it, vi } from "vitest";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { NotSignedInError } from "./session-author";
import { createVerdictReview, loadReviewData } from "./reviews.service";

function client(signedIn = true) {
    const create = vi.fn(async (input: object) => ({ id: "r1", ...input }));
    const queries: string[] = [];
    const entity = (name: string) => ({
        select: () => {
            queries.push(name);
            const builder: Record<string, unknown> = {};
            for (const method of ["orderBy", "first", "after"]) builder[method] = () => builder;
            builder.executePaginated = async () => ({ items: [{ id: `${name}-1` }], hasNextPage: false });
            return builder;
        },
        create,
    });
    const session = signedIn
        ? { isAuthenticated: true, isAnonymous: false, user: { id: "sub-ana", email: "ana.expert@example.com" } }
        : { isAuthenticated: false, isAnonymous: false, user: null };
    const fake = { data: { Verdict: entity("Verdict"), HearingCase: entity("HearingCase"), Hearing: entity("Hearing"), VerdictReview: entity("VerdictReview") }, auth: { getSession: () => session } };
    return { client: fake as unknown as AppRayfinClient, create, queries };
}

describe("reviews service", () => {
    it("creates a review with the signed-in user's own identity, a date and a trimmed comment", async () => {
        const { client: fake, create } = client();
        await createVerdictReview(fake, { verdictId: "v1", humanVerdict: "incorrect", reason: "expected_answer_wrong", comment: "  Count by shipping country.  " });
        const input = create.mock.calls[0][0] as Record<string, unknown>;
        expect(input).toMatchObject({ verdict_id: "v1", humanVerdict: "incorrect", reason: "expected_answer_wrong", comment: "Count by shipping country.", reviewerUserId: "sub-ana", reviewerEmail: "ana.expert@example.com" });
        expect(input.createdAt).toBeInstanceOf(Date);
        expect(input.source).toBeUndefined();
    });

    it("never sends the seed marker: only SQL writes it", async () => {
        const { client: fake, create } = client();
        await createVerdictReview(fake, { verdictId: "v1", humanVerdict: "correct" });
        expect(Object.keys(create.mock.calls[0][0] as object)).not.toContain("source");
    });

    it("needs a signed-in user", async () => {
        const { client: fake, create } = client(false);
        await expect(createVerdictReview(fake, { verdictId: "v1", humanVerdict: "correct" })).rejects.toBeInstanceOf(NotSignedInError);
        expect(create).not.toHaveBeenCalled();
    });

    it("reads verdicts, what each hearing asked, hearings and reviews in one parallel round", async () => {
        const { client: fake, queries } = client();
        const loading = loadReviewData(fake);
        expect([...queries].sort()).toEqual(["Hearing", "HearingCase", "Verdict", "VerdictReview"]);
        const data = await loading;
        expect(data.verdicts).toHaveLength(1);
        expect(data.reviewRecords.hearingCases).toHaveLength(1);
        expect(data.hearings).toHaveLength(1);
        expect(data.reviewRecords.reviews).toHaveLength(1);
    });
});
