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

/** Example jurors are demo rows with a reserved example address (example.com, example.org, example.net or *.example). */
export function isExampleJuror(juror: { email: string }): boolean {
    return /@(?:[a-z0-9-]+\.)*example(?:\.(?:com|org|net))?$/i.test(juror.email.trim());
}

/** The agent's name without a trailing "(example)", so the localized "Example" label is not shown twice. */
export function plainAgentName(agent: Pick<AgentRow, "name">): string {
    return agent.name.replace(EXAMPLE_SUFFIX, "");
}

/**
 * The agents a person can pick. Example agents are hidden unless an admin turned on "Show example agents"; while there
 * are only examples (no real agent yet) they stay so the app is not empty.
 */
export function visibleAgents<T extends AgentIdentity>(active: readonly T[], includeExamples: boolean): T[] {
    const real = active.filter((agent) => !isExampleAgent(agent));
    return real.length === 0 || includeExamples ? [...active] : real;
}

/** The default agent: the requested one if visible, otherwise the first real agent, otherwise the first one. */
export function defaultAgent<T extends AgentIdentity & { id: string }>(visible: readonly T[], requestedId: string | undefined): T | undefined {
    return visible.find((agent) => agent.id === requestedId) ?? visible.find((agent) => !isExampleAgent(agent)) ?? visible[0];
}
