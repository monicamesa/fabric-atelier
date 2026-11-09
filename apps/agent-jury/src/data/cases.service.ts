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
    authorUserId: string;
    authorEmail: string;
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
}

export interface NewCaseDismissal {
    caseId: string;
    reason: string;
}

const CASE_FIELDS = ["id", "agent_id", "text", "category", "tags", "authorUserId", "authorEmail", "createdAt"] as const;
const TESTIMONY_FIELDS = ["id", "case_id", "answer", "definition", "authorUserId", "authorEmail", "createdAt"] as const;
const DISMISSAL_FIELDS = ["id", "case_id", "reason", "dismissedByUserId", "dismissedByEmail", "createdAt"] as const;

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
    return readAllPages((after) => {
        const query = client.data.CaseDismissal.select([...DISMISSAL_FIELDS])
            .where({ case_id: { in: [...caseIds] } })
            .orderBy({ createdAt: "asc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    }) as Promise<CaseDismissalRow[]>;
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
    const created = await client.data.Testimony.create({
        case_id: input.caseId,
        answer: input.answer,
        definition: input.definition,
        authorUserId: author.userId,
        authorEmail: author.email,
        createdAt: new Date(),
    });
    return created as TestimonyRow;
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
