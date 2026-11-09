import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip } from "@/components/docket/chip";
import { TextField } from "@/components/docket/field";
import { ShortId } from "@/components/docket/identity";
import { Segmented } from "@/components/docket/segmented";
import { EmptyState } from "@/components/docket/states";
import type { AgentRow, AuthorActivity } from "@/data/directory.service";
import { ClerkError } from "./clerk-feedback";
import type { ClerkRunner } from "./clerk-runner";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AgentsPanelProps {
    agents: AgentRow[];
    activity?: AuthorActivity;
    clerk: ClerkRunner;
    registerClerk: ClerkRunner;
    onNotice: (message: string) => void;
}

export function AgentsPanel({ agents, activity, clerk, registerClerk, onNotice }: AgentsPanelProps) {
    const { t } = useTranslation();
    const [registering, setRegistering] = useState(false);
    const [filter, setFilter] = useState<"active" | "retired">("active");
    const activeCount = agents.filter((agent) => agent.active).length;
    const shown = agents.filter((agent) => agent.active === (filter === "active"));

    async function setActive(agent: AgentRow, active: boolean) {
        if (await clerk.run("setAgentActive", { agentId: agent.id, active })) {
            onNotice(t(active ? "clerk.agents.done.reinstated" : "clerk.agents.done.retired", { name: agent.name }));
        }
    }

    return (
        <section aria-labelledby="clerk-agents-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h2 id="clerk-agents-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                        {t("clerk.agents.title")}
                    </h2>
                    <p className="m-0 text-[15px] text-text-muted">{t("clerk.agents.help")}</p>
                </div>
                {!registering && (
                    <Button variant="secondary" onClick={() => setRegistering(true)}>
                        {t("clerk.agents.register")}
                    </Button>
                )}
            </div>
            {registering && (
                <RegisterAgentForm
                    clerk={registerClerk}
                    onCancel={() => setRegistering(false)}
                    onRegistered={(name) => {
                        setRegistering(false);
                        onNotice(t("clerk.agents.done.registered", { name }));
                    }}
                />
            )}
            <ClerkError view={clerk.error} />
            {agents.length > 0 && (
                <Segmented<"active" | "retired">
                    label={t("clerk.agents.filter")}
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: "active", label: t("clerk.agents.activeCount", { count: activeCount }) },
                        { value: "retired", label: t("clerk.agents.retiredCount", { count: agents.length - activeCount }) },
                    ]}
                />
            )}
            {agents.length === 0 ? (
                !registering && (
                    <EmptyState
                        message={t("clerk.agents.empty")}
                        action={
                            <Button variant="secondary" compact onClick={() => setRegistering(true)}>
                                {t("clerk.agents.register")}
                            </Button>
                        }
                    />
                )
            ) : shown.length === 0 ? (
                <EmptyState message={t(filter === "active" ? "clerk.agents.emptyActive" : "clerk.agents.emptyRetired")} />
            ) : (
                <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 min-[900px]:grid-cols-2">
                    {shown.map((agent) => (
                        <li key={agent.id}>
                            <article
                                aria-label={agent.name}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border border-ink bg-paper-raised p-4"
                            >
                                <b className="font-serif text-[20px] text-ink">{agent.name}</b>
                                <Chip tone={agent.active ? "ruled" : "muted"} filled={agent.active}>
                                    {t(agent.active ? "clerk.agents.active" : "clerk.agents.retired")}
                                </Chip>
                                <ShortId id={agent.itemId} label={t("clerk.agents.itemId")} />
                                {agent.active ? (
                                    <Button variant="danger-text" compact disabled={clerk.pending} onClick={() => void setActive(agent, false)}>
                                        {t("clerk.agents.retire")}
                                    </Button>
                                ) : (
                                    <Button variant="quiet" compact disabled={clerk.pending} onClick={() => void setActive(agent, true)}>
                                        {t("clerk.agents.reinstate")}
                                    </Button>
                                )}
                                <span className="text-[14px] text-text-muted">
                                    {activity ? t("clerk.agents.cases", { count: activity.casesByAgent.get(agent.id.toLowerCase()) ?? 0 }) : "—"}
                                </span>
                            </article>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

interface RegisterAgentFormProps {
    clerk: ClerkRunner;
    onCancel: () => void;
    onRegistered: (name: string) => void;
}

function RegisterAgentForm({ clerk, onCancel, onRegistered }: RegisterAgentFormProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [workspaceId, setWorkspaceId] = useState("");
    const [itemId, setItemId] = useState("");
    const [errors, setErrors] = useState<{ name?: string; workspaceId?: string; itemId?: string }>({});

    async function submit(event: FormEvent) {
        event.preventDefault();
        const next = {
            name: name.trim() ? undefined : t("clerk.registerAgent.nameRequired"),
            workspaceId: GUID.test(workspaceId.trim()) ? undefined : t("clerk.registerAgent.invalidId"),
            itemId: GUID.test(itemId.trim()) ? undefined : t("clerk.registerAgent.invalidId"),
        };
        setErrors(next);
        if (next.name || next.workspaceId || next.itemId) return;
        if (await clerk.run("registerAgent", { name: name.trim(), workspaceId: workspaceId.trim(), itemId: itemId.trim() })) {
            onRegistered(name.trim());
        }
    }

    return (
        <form
            noValidate
            aria-labelledby="clerk-register-title"
            onSubmit={(event) => void submit(event)}
            className="flex flex-col gap-3.5 border border-ink bg-paper-raised p-5"
        >
            <h3 id="clerk-register-title" className="m-0 font-serif text-[22px] font-bold text-ink">
                {t("clerk.registerAgent.title")}
            </h3>
            <div className="grid grid-cols-1 gap-3.5 min-[900px]:grid-cols-3">
                <TextField
                    label={t("clerk.registerAgent.name")}
                    hint={t("clerk.registerAgent.nameHint")}
                    error={errors.name}
                    maxLength={200}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <TextField
                    label={t("clerk.registerAgent.workspaceId")}
                    hint={t("clerk.registerAgent.idHint")}
                    error={errors.workspaceId}
                    maxLength={36}
                    value={workspaceId}
                    onChange={(event) => setWorkspaceId(event.target.value)}
                />
                <TextField
                    label={t("clerk.registerAgent.itemId")}
                    hint={t("clerk.registerAgent.idHint")}
                    error={errors.itemId}
                    maxLength={36}
                    value={itemId}
                    onChange={(event) => setItemId(event.target.value)}
                />
            </div>
            <ClerkError view={clerk.error} />
            <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="secondary" disabled={clerk.pending}>
                    {clerk.pending ? t("clerk.registerAgent.submitting") : t("clerk.registerAgent.submit")}
                </Button>
                <Button variant="link" onClick={onCancel}>
                    {t("clerk.registerAgent.cancel")}
                </Button>
            </div>
        </form>
    );
}
