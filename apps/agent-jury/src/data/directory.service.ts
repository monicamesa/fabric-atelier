import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { JurorRole } from "@/rules/case-validity";
import { PAGE_SIZE, readAllPages } from "./pagination";

type DataClient = Pick<AppRayfinClient, "data">;

export interface JurorRow {
    id: string;
    email: string;
    role: JurorRole;
    team?: string | null;
    active: boolean;
}

export interface AgentRow {
    id: string;
    name: string;
    active: boolean;
}

export function listJurors(client: DataClient): Promise<JurorRow[]> {
    return readAllPages((after) => {
        const query = client.data.Juror.select(["id", "email", "role", "team", "active"])
            .orderBy({ email: "asc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    });
}

export function listAgents(client: DataClient): Promise<AgentRow[]> {
    return readAllPages((after) => {
        const query = client.data.Agent.select(["id", "name", "active"])
            .orderBy({ name: "asc" })
            .first(PAGE_SIZE);
        return (after ? query.after(after) : query).executePaginated();
    });
}
