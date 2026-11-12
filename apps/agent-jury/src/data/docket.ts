import type { AppRayfinClient } from "@/lib/rayfin-client";
import {
    analyzeCase,
    needsMyVote,
    type CaseAnalysis,
    type CaseRecords,
    type JurorRecord,
    type Me,
} from "@/rules/case-validity";
import { judgeTrust, type JudgeTrust } from "@/rules/judge-trust";
import {
    getCase,
    listAllCases,
    listAllCaseDismissals,
    listAllTestimonies,
    listAllVotes,
    listCaseDismissals,
    listCasesByAgent,
    listTestimonies,
    type CaseDismissalRow,
    type CaseRow,
    type TestimonyRow,
    type VoteRow,
} from "./cases.service";
import { buildTicker, type TickerEvent } from "./ticker-events";
import { EMPTY_REVIEW_DATA, loadReviewData, type ReviewData } from "./reviews.service";

type DataClient = Pick<AppRayfinClient, "data" | "auth">;

export interface DocketRecords {
    cases: CaseRow[];
    testimonies: TestimonyRow[];
    votes: VoteRow[];
    dismissals: CaseDismissalRow[];
    /** Verdicts, hearings and reviews: R9 needs them to reopen a ruled case, and judge trust is computed from them. */
    reviews?: ReviewData;
}

export interface DocketCase {
    record: CaseRow;
    testimonies: TestimonyRow[];
    votes: VoteRow[];
    dismissals: CaseDismissalRow[];
    analysis: CaseAnalysis;
    needsMyVote: boolean;
    proposedByMe: boolean;
    records: CaseRecords;
}

export interface Docket {
    cases: DocketCase[];
    categories: string[];
    /** The latest news of the docket, derived from the records already loaded (see ticker-events.ts). */
    ticker: TickerEvent[];
    /** Judge trust of the agent, per critic-prompt version. Only when the agent is known. */
    trust?: JudgeTrust;
    /** False when verdicts and reviews could not be read: judge trust and the judge lines of the ticker are then hidden. */
    reviewsAvailable: boolean;
}

/** D8: trims and collapses spaces; categories compare without case. */
export function normalizeCategory(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

/** Returns the existing spelling when the category is already used, so "sales " doesn't become a second "Sales". */
export function canonicalCategory(value: string, existing: readonly string[]): string {
    const normalized = normalizeCategory(value);
    return existing.find((category) => category.toLowerCase() === normalized.toLowerCase()) ?? normalized;
}

/** Groups the records of one agent by case and computes every state (R1–R9) and, for a known agent, judge trust. */
export function buildDocket(raw: DocketRecords, jurors: readonly JurorRecord[], me: Me | undefined, now: Date, agentId?: string): Docket {
    const reviews = raw.reviews ?? EMPTY_REVIEW_DATA;
    const cases = raw.cases.map((record): DocketCase => {
        const testimonies = raw.testimonies.filter((testimony) => testimony.case_id === record.id);
        const ids = new Set(testimonies.map((testimony) => testimony.id));
        const votes = raw.votes.filter((vote) => ids.has(vote.testimony_id));
        const dismissals = raw.dismissals.filter((dismissal) => dismissal.case_id === record.id);
        const verdicts = reviews.reviewRecords.verdicts.filter((verdict) => verdict.case_id === record.id);
        const verdictIds = new Set(verdicts.map((verdict) => verdict.id));
        const reviewRecords = {
            verdicts,
            hearingCases: reviews.reviewRecords.hearingCases.filter((link) => link.case_id === record.id),
            reviews: reviews.reviewRecords.reviews.filter((review) => verdictIds.has(review.verdict_id)),
        };
        const records: CaseRecords = { caseRecord: record, testimonies, votes, dismissals, jurors, now, reviewRecords };
        const analysis = analyzeCase(records);
        return {
            record,
            testimonies,
            votes,
            dismissals,
            analysis,
            records,
            needsMyVote: me ? needsMyVote(records, analysis, me) : false,
            proposedByMe: me ? record.authorUserId === me.userId : false,
        };
    });
    const categories: string[] = [];
    for (const docketCase of cases) {
        const category = normalizeCategory(docketCase.record.category);
        if (category && !categories.some((existing) => existing.toLowerCase() === category.toLowerCase())) categories.push(category);
    }
    const available = reviews.available;
    const trust =
        agentId && available
            ? judgeTrust({ agentId, hearings: reviews.hearings, verdicts: reviews.verdicts, reviewRecords: reviews.reviewRecords, jurors, now })
            : undefined;
    const judge = available ? { hearings: reviews.hearings, verdicts: reviews.verdicts, overruled: trust?.overruled ?? [] } : undefined;
    return { cases, categories: categories.sort((a, b) => a.localeCompare(b)), ticker: buildTicker(cases, judge), trust, reviewsAvailable: available };
}

/** Keeps only the testimonies, votes and dismissals that belong to `cases`. */
export function scopeToCases(cases: CaseRow[], all: Omit<DocketRecords, "cases">): DocketRecords {
    const caseIds = new Set(cases.map((record) => record.id));
    const testimonies = all.testimonies.filter((testimony) => caseIds.has(testimony.case_id));
    const testimonyIds = new Set(testimonies.map((testimony) => testimony.id));
    return {
        cases,
        testimonies,
        votes: all.votes.filter((vote) => testimonyIds.has(vote.testimony_id)),
        dismissals: all.dismissals.filter((dismissal) => caseIds.has(dismissal.case_id)),
        reviews: all.reviews,
    };
}

/**
 * Reads every case of an agent with its testimonies, votes and dismissals in one parallel round.
 * Testimonies, votes and dismissals are read whole and scoped here: the data API can't filter them
 * by agent, and chaining id filters cost three sequential round trips. Verdicts, hearings and reviews
 * join the same round (R9 and judge trust).
 */
export async function loadDocketRecords(client: DataClient, agentId: string): Promise<DocketRecords> {
    const [cases, testimonies, votes, dismissals, reviews] = await Promise.all([
        listCasesByAgent(client, agentId),
        listAllTestimonies(client),
        listAllVotes(client),
        listAllCaseDismissals(client),
        loadReviewData(client),
    ]);
    return scopeToCases(cases, { testimonies, votes, dismissals, reviews });
}

/** Every agent's records in one parallel round, for when the agent isn't known yet (no agent in the URL). */
export async function loadAllDocketRecords(client: DataClient): Promise<DocketRecords> {
    const [cases, testimonies, votes, dismissals, reviews] = await Promise.all([
        listAllCases(client),
        listAllTestimonies(client),
        listAllVotes(client),
        listAllCaseDismissals(client),
        loadReviewData(client),
    ]);
    return { cases, testimonies, votes, dismissals, reviews };
}

export function scopeToAgent(records: DocketRecords, agentId: string): DocketRecords {
    return scopeToCases(
        records.cases.filter((record) => record.agent_id === agentId),
        records,
    );
}

/** Reads one case with its testimonies, votes, dismissals and reviews in one parallel round; `undefined` when the case doesn't exist. */
export async function loadCaseRecords(client: DataClient, caseId: string): Promise<DocketRecords | undefined> {
    const [record, testimonies, votes, dismissals, reviews] = await Promise.all([
        getCase(client, caseId),
        listTestimonies(client, caseId),
        listAllVotes(client),
        listCaseDismissals(client, [caseId]),
        loadReviewData(client),
    ]);
    return record ? scopeToCases([record], { testimonies, votes, dismissals, reviews }) : undefined;
}
