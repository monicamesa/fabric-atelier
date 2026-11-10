import { useMemo } from "react";
import type { JurorRow } from "@/data/directory.service";
import { buildDocket, loadAllDocketRecords, loadDocketRecords, scopeToAgent, type Docket } from "@/data/docket";
import { useAsync, type AsyncState } from "@/hooks/use-async";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { Me } from "@/rules/case-validity";

export type DocketState = AsyncState<Docket> & { reload: () => void };

/**
 * Records for one agent, turned into states once the jury list is in. Without `requestedAgentId`
 * every agent's records load in the same round as the jury and agent lists, and `agentId` (known
 * later) picks the agent. Remount (key by requested agent) to switch agents.
 */
export function useDocket(
    client: AppRayfinClient,
    requestedAgentId: string | undefined,
    agentId: string | undefined,
    jurors: readonly JurorRow[] | undefined,
    me: Me | undefined,
): DocketState {
    const records = useAsync(() => (requestedAgentId ? loadDocketRecords(client, requestedAgentId) : loadAllDocketRecords(client)));
    const data = useMemo(
        () => (records.data && jurors && agentId ? buildDocket(scopeToAgent(records.data, agentId), jurors, me, new Date()) : undefined),
        [records.data, jurors, me, agentId],
    );
    return { ...records, data } as DocketState;
}
