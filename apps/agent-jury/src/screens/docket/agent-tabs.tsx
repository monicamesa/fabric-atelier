import { useTranslation } from "react-i18next";
import type { AgentRow } from "@/data/directory.service";
import { isExampleAgent, plainAgentName } from "@/data/example-agents";
import { Segmented } from "@/components/docket/segmented";
import { SelectField } from "@/components/docket/field";

const MAX_TABS = 4;

/** Picks the agent on trial. Segmented buttons for a few agents, a select when there are more. */
export function AgentTabs({ agents, current, onChange }: { agents: AgentRow[]; current: string; onChange: (agentId: string) => void }) {
    const { t } = useTranslation();
    if (agents.length <= 1) return null;
    const label = (agent: AgentRow) => (isExampleAgent(agent) ? `${plainAgentName(agent)} · ${t("docket.example")}` : agent.name);
    if (agents.length > MAX_TABS) {
        return (
            <SelectField label={t("docket.agent")} hiddenLabel value={current} onChange={onChange}>
                {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                        {label(agent)}
                    </option>
                ))}
            </SelectField>
        );
    }
    return (
        <Segmented<string>
            label={t("docket.agent")}
            value={current}
            onChange={onChange}
            options={agents.map((agent) => ({ value: agent.id, label: label(agent) }))}
        />
    );
}
