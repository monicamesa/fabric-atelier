import { useMemo } from "react";
import type { JurorRow } from "@/data/directory.service";
import { buildDocket, loadDocketRecords, type Docket } from "@/data/docket";
import { useAsync, type AsyncState } from "@/hooks/use-async";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { Me } from "@/rules/case-validity";

export type DocketState = AsyncState<Docket> & { reload: () => void };

/** Records for one agent, turned into states with the shared rules. Remount (key by agent) to switch agents. */
export function useDocket(client: AppRayfinClient, agentId: string, jurors: readonly JurorRow[], me: Me | undefined): DocketState {
    const records = useAsync(() => loadDocketRecords(client, agentId));
    const data = useMemo(() => (records.data ? buildDocket(records.data, jurors, me, new Date()) : undefined), [records.data, jurors, me]);
    return { ...records, data } as DocketState;
}
