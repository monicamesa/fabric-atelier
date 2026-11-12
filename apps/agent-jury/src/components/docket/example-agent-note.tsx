import { useTranslation } from "react-i18next";
import { isExampleAgent } from "@/data/example-agents";
import type { AgentRow } from "@/data/directory.service";

/** Shown on an example agent's screens (admins can switch to one): it never counts in hearings, judge trust or the export. */
export function ExampleAgentNote({ agent }: { agent?: AgentRow }) {
    const { t } = useTranslation();
    if (!agent || !isExampleAgent(agent)) return null;
    return (
        <p role="note" className="m-0 border border-ink bg-paper-raised px-4 py-3 text-[15px] text-text">
            <b className="mr-2 uppercase tracking-[0.14em] text-ink">{t("docket.example")}</b>
            {t("docket.exampleNote")}
        </p>
    );
}
