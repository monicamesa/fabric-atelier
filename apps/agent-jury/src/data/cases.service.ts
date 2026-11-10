import type { AppRayfinClient } from "@/lib/rayfin-client";
import { PAGE_SIZE, readAllPages } from "./pagination";
import { getSessionAuthor } from "./session-author";

type DataClient = Pick<AppRayfinClient, "data" | "auth">;

export interface CaseRow {
    id: string;
    agent_id: string;
    text: string;
    category: string;
    tags?: string | null;
    authorUserId: string;
    authorEmail: string;
    createdAt: Date | string;
}

export interface TestimonyRow {
    id: string;
    case_id: string;
    answer: string;
    definition: string;
    criterion?: string | null;
    timeWindow?: string | null;
    population?: string | null;
    source?: string | null;
    authorUserId: string;
    authorEmail: string;
    createdAt: Date | string;
}

export interface VoteRow {
    id: string;
    testimony_id: string;
    value: "for" | "against";
    comment?: string | null;
    voterUserId: string;
    voterEmail: string;
    createdAt: Date | string;
}

export interface CaseDismissalRow {
    id: string;
    case_id: string;
    reason: string;
    dismissedByUserId: string;
    dismissedByEmail: string;
    createdAt: Date | string;
}

export interface NewCase {
    agentId: string;
    text: string;
    category: string;
    tags?: string;
}

export interface NewTestimony {
    caseId: string;
    answer: string;
    definition: string;
    criterion?: string;
    timeWindow?: string;
    population?: string;
    source?: string;
}

export interface NewVote {
    testimonyId: string;
    value: "for" | "against";
    comment?: string;
}

export interface NewCaseDismissal {
    caseId: string;
    reason: string;
}

const CASE_FIELDS = ["id", "agent_id", "text", "category", "tags", "authorUserId", "authorEmail", "createdAt"] as const;
const TESTIMONY_FIELDS = [
    "id",
    "case_id",
    "answer",
    "definition",
    "criterion",
    "timeWindow",
    "population",
    "source",
    "authorUserId",
    "authorEmail",
    "createdAt",
] as const;
const VOTE_FIELDS = ["id", "testimony_id", "value", "comment", "voterUserId", "voterEmail", "createdAt"] as const;
const DISMISSAL_FIELDS = ["id", "case_id", "reason", "dismissedByUserId", "dismissedByEmail", "createdAt"] as const;
// Keeps `in` filters to a modest size per request.
const ID_CHUNK = 50;
// Whole-table reads: each request costs a fixed ~20 s on the test backend, so fewer, larger pages.
const BULK_PAGE_SIZE = 1000;

function chunks<T>(items: readonly T[]): T[][] {
    const out: T[][] = [];
    for (let index = 0; index < items.length; index += ID_CHUNK) out.push(items.slice(index, index + ID_CHUNK));
    return out;
}

export async function getCase(client: DataClient, caseId: string): Promise<CaseRow | undefined> {
    const rows = (await client.data.Case.select([...CASE_FIELDS]).where({ id: { eq: caseId } }).first(1).execute()) as CaseRow[] | undefined;
    return rows?.[0];
}

export async function listAllTestimonies(client: DataClient): Promise<TestimonyRow[]> {
    return (await readAllPages((after) => {
        const query = client.data.Testimony.select([...TESTIMONY_FIELDS]).orderBy({ createdAt: "asc" }).first(BULK_PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    })) as TestimonyRow[];
}

export async function listAllVotes(client: DataClient): Promise<VoteRow[]> {
    return (await readAllPages((after) => {
        const query = client.data.Vote.select([...VOTE_FIELDS]).orderBy({ createdAt: "asc" }).first(BULK_PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    })) as VoteRow[];
}

export async function listAllCaseDismissals(client: DataClient): Promise<CaseDismissalRow[]> {
    return (await readAllPages((after) => {
        const query = client.data.CaseDismissal.select([...DISMISSAL_FIELDS]).orderBy({ createdAt: "asc" }).first(BULK_PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    })) as CaseDismissalRow[];
}

export async function listAllCases(client: DataClient): Promise<CaseRow[]> {
    return (await readAllPages((after) => {
        const query = client.data.Case.select([...CASE_FIELDS]).orderBy({ createdAt: "desc" }).first(BULK_PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    })) as CaseRow[];
}

export function listCasesByAgent(client: DataClient, agentId: string): Promise<CaseRow[]> {
    return readAllPages((after) => {
        const query = client.data.Case.select([...CASE_FIELDS])
            .where({ agent_id: { eq: agentId } })
            .orderBy({ createdAt: "desc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    }) as Promise<CaseRow[]>;
}

export function listTestimonies(client: DataClient, caseId: string): Promise<TestimonyRow[]> {
    return readAllPages((after) => {
        const query = client.data.Testimony.select([...TESTIMONY_FIELDS])
            .where({ case_id: { eq: caseId } })
            .orderBy({ createdAt: "asc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    }) as Promise<TestimonyRow[]>;
}

export function listCaseDismissals(client: DataClient, caseIds: readonly string[]): Promise<CaseDismissalRow[]> {
    if (caseIds.length === 0) {
        return Promise.resolve([]);
    }
    return Promise.all(
        chunks(caseIds).map((ids) =>
            readAllPages((after) => {
                const query = client.data.CaseDismissal.select([...DISMISSAL_FIELDS])
                    .where({ case_id: { in: ids } })
                    .orderBy({ createdAt: "asc" })
                    .first(PAGE_SIZE);
                return (after ? query.after(after) : query).executePaginated();
            }),
        ),
    ).then((pages) => pages.flat() as CaseDismissalRow[]);
}

export async function createCase(client: DataClient, input: NewCase): Promise<CaseRow> {
    const author = getSessionAuthor(client);
    const created = await client.data.Case.create({
        agent_id: input.agentId,
        text: input.text,
        category: input.category,
        tags: input.tags,
        authorUserId: author.userId,
        authorEmail: author.email,
        createdAt: new Date(),
    });
    return created as CaseRow;
}

export async function createTestimony(client: DataClient, input: NewTestimony): Promise<TestimonyRow> {
    const author = getSessionAuthor(client);
    const optional = (value?: string) => value?.trim() || undefined;
    const created = await client.data.Testimony.create({
        case_id: input.caseId,
        answer: input.answer,
        definition: input.definition,
        criterion: optional(input.criterion),
        timeWindow: optional(input.timeWindow),
        population: optional(input.population),
        source: optional(input.source),
        authorUserId: author.userId,
        authorEmail: author.email,
        createdAt: new Date(),
    });
    return created as TestimonyRow;
}

export async function createVote(client: DataClient, input: NewVote): Promise<VoteRow> {
    const voter = getSessionAuthor(client);
    const created = await client.data.Vote.create({
        testimony_id: input.testimonyId,
        value: input.value,
        comment: input.comment?.trim() || undefined,
        voterUserId: voter.userId,
        voterEmail: voter.email,
        createdAt: new Date(),
    });
    return created as VoteRow;
}

export async function createCaseDismissal(client: DataClient, input: NewCaseDismissal): Promise<CaseDismissalRow> {
    const author = getSessionAuthor(client);
    const created = await client.data.CaseDismissal.create({
        case_id: input.caseId,
        reason: input.reason,
        dismissedByUserId: author.userId,
        dismissedByEmail: author.email,
        createdAt: new Date(),
    });
    return created as CaseDismissalRow;
}
