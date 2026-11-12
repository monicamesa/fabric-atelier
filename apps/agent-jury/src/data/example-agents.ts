import type { AgentRow } from "./directory.service";

/** The placeholder GUID prefix the example data uses (rayfin/seed/seed.sql); real Fabric items never start with it. */
const PLACEHOLDER_ID_PREFIX = "00000000-0000-4000-8000-";
const EXAMPLE_SUFFIX = /\s*\((example|ejemplo)\)\s*$/i;

type AgentIdentity = Pick<AgentRow, "name" | "workspaceId" | "itemId">;

/** Example agents are demo rows (placeholder ids, "(example)" in the name): they never count in hearings, trust or the export. */
export function isExampleAgent(agent: AgentIdentity): boolean {
    return (
        agent.workspaceId.startsWith(PLACEHOLDER_ID_PREFIX) ||
        agent.itemId.startsWith(PLACEHOLDER_ID_PREFIX) ||
        EXAMPLE_SUFFIX.test(agent.name)
    );
}

/** The agent's name without a trailing "(example)", so the localized "Example" label is not shown twice. */
export function plainAgentName(agent: Pick<AgentRow, "name">): string {
    return agent.name.replace(EXAMPLE_SUFFIX, "");
}

/**
 * The agents a person can pick. Once a real agent exists, example agents are hidden from everyone but admins
 * (who see them labelled "Example"); while there are only examples, they stay so the app is not empty.
 */
export function visibleAgents<T extends AgentIdentity>(active: readonly T[], isAdmin: boolean): T[] {
    const real = active.filter((agent) => !isExampleAgent(agent));
    return real.length === 0 || isAdmin ? [...active] : real;
}

/** The default agent: the requested one if visible, otherwise the first real agent, otherwise the first one. */
export function defaultAgent<T extends AgentIdentity & { id: string }>(visible: readonly T[], requestedId: string | undefined): T | undefined {
    return visible.find((agent) => agent.id === requestedId) ?? visible.find((agent) => !isExampleAgent(agent)) ?? visible[0];
}
