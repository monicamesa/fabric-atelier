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

/** The ticker shows verdicts only (appeals join in I4); proposals and returns to review stay in the court record. */
const VERDICT_STATES = new Set<string>(["ruled", "disputed", "dismissed"]);

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
                .filter((event) => event.kind === "state" && VERDICT_STATES.has(event.state))
                .map((event) => ({ caseId: docketCase.record.id, caseText: docketCase.record.text, event })),
        )
        .sort((a, b) => b.event.at.localeCompare(a.event.at))
        .slice(0, 12);
    return { cases, categories: categories.sort((a, b) => a.localeCompare(b)), ticker };
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
    };
}

/**
 * Reads every case of an agent with its testimonies, votes and dismissals in one parallel round.
 * Testimonies, votes and dismissals are read whole and scoped here: the data API can't filter them
 * by agent, and chaining id filters cost three sequential round trips.
 */
export async function loadDocketRecords(client: DataClient, agentId: string): Promise<DocketRecords> {
    const [cases, testimonies, votes, dismissals] = await Promise.all([
        listCasesByAgent(client, agentId),
        listAllTestimonies(client),
        listAllVotes(client),
        listAllCaseDismissals(client),
    ]);
    return scopeToCases(cases, { testimonies, votes, dismissals });
}

/** Every agent's records in one parallel round, for when the agent isn't known yet (no agent in the URL). */
export async function loadAllDocketRecords(client: DataClient): Promise<DocketRecords> {
    const [cases, testimonies, votes, dismissals] = await Promise.all([
        listAllCases(client),
        listAllTestimonies(client),
        listAllVotes(client),
        listAllCaseDismissals(client),
    ]);
    return { cases, testimonies, votes, dismissals };
}

export function scopeToAgent(records: DocketRecords, agentId: string): DocketRecords {
    return scopeToCases(
        records.cases.filter((record) => record.agent_id === agentId),
        records,
    );
}

/** Reads one case with its testimonies, votes and dismissals in one parallel round; `undefined` when the case doesn't exist. */
export async function loadCaseRecords(client: DataClient, caseId: string): Promise<DocketRecords | undefined> {
    const [record, testimonies, votes, dismissals] = await Promise.all([
        getCase(client, caseId),
        listTestimonies(client, caseId),
        listAllVotes(client),
        listCaseDismissals(client, [caseId]),
    ]);
    return record ? scopeToCases([record], { testimonies, votes, dismissals }) : undefined;
}
