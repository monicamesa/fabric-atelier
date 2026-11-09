import type { AppRayfinClient } from "@/lib/rayfin-client";
import {
    analyzeCase,
    caseEvents,
    needsMyVote,
    type CaseAnalysis,
    type CaseEvent,
    type CaseRecords,
    type JurorRecord,
    type Me,
} from "@/rules/case-validity";
import {
    listCaseDismissals,
    listCasesByAgent,
    listTestimoniesForCases,
    listVotesForTestimonies,
    type CaseDismissalRow,
    type CaseRow,
    type TestimonyRow,
    type VoteRow,
} from "./cases.service";

type DataClient = Pick<AppRayfinClient, "data" | "auth">;

export interface DocketRecords {
    cases: CaseRow[];
    testimonies: TestimonyRow[];
    votes: VoteRow[];
    dismissals: CaseDismissalRow[];
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

export interface TickerEvent {
    caseId: string;
    caseText: string;
    event: CaseEvent;
}

export interface Docket {
    cases: DocketCase[];
    categories: string[];
    ticker: TickerEvent[];
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

/** Groups the records of one agent by case and computes every state with the shared rules. */
export function buildDocket(raw: DocketRecords, jurors: readonly JurorRecord[], me: Me | undefined, now: Date): Docket {
    const cases = raw.cases.map((record): DocketCase => {
        const testimonies = raw.testimonies.filter((testimony) => testimony.case_id === record.id);
        const ids = new Set(testimonies.map((testimony) => testimony.id));
        const votes = raw.votes.filter((vote) => ids.has(vote.testimony_id));
        const dismissals = raw.dismissals.filter((dismissal) => dismissal.case_id === record.id);
        const records: CaseRecords = { caseRecord: record, testimonies, votes, dismissals, jurors, now };
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
    const ticker = cases
        .flatMap((docketCase) =>
            caseEvents(docketCase.records)
                .filter((event) => event.kind === "state" || event.kind === "proposed")
                .map((event) => ({ caseId: docketCase.record.id, caseText: docketCase.record.text, event })),
        )
        .sort((a, b) => b.event.at.localeCompare(a.event.at))
        .slice(0, 12);
    return { cases, categories: categories.sort((a, b) => a.localeCompare(b)), ticker };
}

/** Reads every case of an agent with its testimonies, votes and dismissals. */
export async function loadDocketRecords(client: DataClient, agentId: string): Promise<DocketRecords> {
    const cases = await listCasesByAgent(client, agentId);
    const caseIds = cases.map((record) => record.id);
    const [testimonies, dismissals] = await Promise.all([listTestimoniesForCases(client, caseIds), listCaseDismissals(client, caseIds)]);
    const votes = await listVotesForTestimonies(
        client,
        testimonies.map((testimony) => testimony.id),
    );
    return { cases, testimonies, votes, dismissals };
}
