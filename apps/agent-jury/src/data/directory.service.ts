import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { JurorRole } from "@/rules/case-validity";
import { PAGE_SIZE, readAllPages } from "./pagination";

type DataClient = Pick<AppRayfinClient, "data">;

export interface JurorRow {
    id: string;
    email: string;
    displayName?: string | null;
    role: JurorRole;
    team?: string | null;
    active: boolean;
}

export interface AgentRow {
    id: string;
    name: string;
    workspaceId: string;
    itemId: string;
    active: boolean;
}

/** Who wrote what, for the activity column and agent case counts. */
export interface AuthorActivity {
    casesByEmail: Map<string, number>;
    testimoniesByEmail: Map<string, number>;
    casesByAgent: Map<string, number>;
}

export function listJurors(client: DataClient): Promise<JurorRow[]> {
    return readAllPages((after) => {
        const query = client.data.Juror.select(["id", "email", "displayName", "role", "team", "active"])
            .orderBy({ email: "asc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    });
}

export function listAgents(client: DataClient): Promise<AgentRow[]> {
    return readAllPages((after) => {
        const query = client.data.Agent.select(["id", "name", "workspaceId", "itemId", "active"])
            .orderBy({ name: "asc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    });
}

function increment(counts: Map<string, number>, key: string): void {
    counts.set(key, (counts.get(key) ?? 0) + 1);
}

export async function readAuthorActivity(client: DataClient): Promise<AuthorActivity> {
    const [cases, testimonies] = await Promise.all([
        readAllPages((after) => {
            const query = client.data.Case.select(["id", "agent_id", "authorEmail"]).orderBy({ id: "asc" }).first(PAGE_SIZE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        readAllPages((after) => {
            const query = client.data.Testimony.select(["id", "authorEmail"]).orderBy({ id: "asc" }).first(PAGE_SIZE);
            return (after ? query.after(after) : query).executePaginated();
        }),
    ]);
    const activity: AuthorActivity = { casesByEmail: new Map(), testimoniesByEmail: new Map(), casesByAgent: new Map() };
    for (const row of cases) {
        increment(activity.casesByEmail, row.authorEmail.toLowerCase());
        increment(activity.casesByAgent, row.agent_id.toLowerCase());
    }
    for (const row of testimonies) {
        increment(activity.testimoniesByEmail, row.authorEmail.toLowerCase());
    }
    return activity;
}
