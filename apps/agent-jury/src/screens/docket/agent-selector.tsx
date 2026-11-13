import { useTranslation } from "react-i18next";
import type { AgentRow } from "@/data/directory.service";
import { isExampleAgent, plainAgentName } from "@/data/example-agents";
import { AgentTabs } from "./agent-tabs";
import { AGENT_SELECTOR_ID } from "./agent-selector-focus";


/**
 * The one place to choose the agent on Home, Cases and Hearings: coral small-caps step label, the control, and a plain
 * helper line. With a single agent there is nothing to choose, so its name is shown instead of a control.
 */
export function AgentSelector({ agents, current, onChange }: { agents: AgentRow[]; current: AgentRow; onChange: (agentId: string) => void }) {
    const { t } = useTranslation();
    const labelId = "agent-selector-label";
    return (
        <section id={AGENT_SELECTOR_ID} tabIndex={-1} aria-labelledby={labelId} className="flex flex-col gap-1.5 border-b border-rule pb-3 outline-offset-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span id={labelId} className="text-[13px] font-bold uppercase tracking-[0.14em] text-action-text">
                    {t("selector.label")}
                </span>
                {agents.length > 1 ? (
                    <AgentTabs agents={agents} current={current.id} onChange={onChange} />
                ) : (
                    <span className="font-serif text-[20px] font-bold text-ink">{isExampleAgent(current) ? `${plainAgentName(current)} · ${t("docket.example")}` : current.name}</span>
                )}
            </div>
            <p className="m-0 text-[14px] text-text-muted">{t("selector.help")}</p>
        </section>
    );
}
