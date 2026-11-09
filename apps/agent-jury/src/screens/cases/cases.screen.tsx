import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Deliberating } from "@/components/docket/gavel";
import { Objection } from "@/components/docket/objection";
import { Segmented } from "@/components/docket/segmented";
import { CaseNumber, UnverifiedChip } from "@/components/docket/status-chip";
import { EmptyState, Skeleton } from "@/components/docket/states";
import { VoteBar } from "@/components/docket/vote-bar";
import type { AgentRow } from "@/data/directory.service";
import type { DocketCase } from "@/data/docket";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { formatRoute, type CasesFilter } from "@/lib/route";
import { isValidDismissal, type CaseState } from "@/rules/case-validity";
import { CONSENSUS_MIN_VOTES } from "@/rules/consensus";
import { cn } from "@/lib/utils";
import { AgentTabs } from "../docket/agent-tabs";
import { applyFilter } from "../docket/docket-views";
import { ProposeCaseForm } from "../docket/propose-case-form";
import type { DocketState } from "../docket/use-docket";
import type { Viewer } from "../docket/viewer";

const COLUMNS: { state: CaseState; rule: string }[] = [
    { state: "under_review", rule: "border-review" },
    { state: "disputed", rule: "border-action" },
    { state: "ruled", rule: "border-ruled" },
    { state: "dismissed", rule: "border-text-muted" },
];
const VISIBLE = 5;

interface CasesScreenProps {
    client: AppRayfinClient;
    agents: AgentRow[];
    agent: AgentRow;
    docket: DocketState;
    viewer: Viewer;
    filter: CasesFilter;
    query: string;
    onRouteChange: (next: { agentId?: string; filter?: CasesFilter; query?: string }, replace?: boolean) => void;
    onOpenCase: (caseId: string) => void;
}

export function CasesScreen({ client, agents, agent, docket, viewer, filter, query, onRouteChange, onOpenCase }: CasesScreenProps) {
    const { t } = useTranslation();
    const [proposing, setProposing] = useState(false);
    const [expanded, setExpanded] = useState<Set<CaseState>>(new Set());
    const data = docket.data;
    const visible = useMemo(() => (data ? applyFilter(data.cases, filter, query) : []), [data, filter, query]);
    const waiting = data?.cases.filter((item) => item.needsMyVote).length ?? 0;

    const header = (
        <div className="grid gap-5 border-b-[6px] border-double border-ink pb-5 min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-end">
            <div className="flex flex-col gap-2">
                <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-action-text">
                    {t("cases.kicker", { agent: agent.name, count: data?.cases.length ?? 0 })}
                </span>
                <h1 className="m-0 font-serif text-[44px] font-black leading-[0.95] tracking-[-0.03em] text-ink min-[900px]:text-[64px]">
                    {t("cases.title")}
                </h1>
                <p className="m-0 max-w-[700px] text-[17px] text-text">{t("cases.help")}</p>
            </div>
            <div className="flex flex-col items-start gap-3 min-[900px]:items-end">
                <AgentTabs agents={agents} current={agent.id} onChange={(agentId) => onRouteChange({ agentId })} />
                {viewer.canAct && !proposing && (
                    <Button variant="primary" onClick={() => setProposing(true)}>
                        {t("docket.propose")}
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            {header}
            {!viewer.canAct && <p className="m-0 border-l-4 border-review pl-3 text-[15px] text-text">{t("docket.readOnly")}</p>}
            {proposing && (
                <ProposeCaseForm
                    client={client}
                    agentId={agent.id}
                    agentName={agent.name}
                    categories={data?.categories ?? []}
                    onCancel={() => setProposing(false)}
                    onSaved={(caseId) => onOpenCase(caseId)}
                />
            )}
            <div className="flex flex-col gap-3 border-b border-ink pb-4 min-[900px]:flex-row min-[900px]:items-center">
                <label className="flex min-h-11 flex-1 items-center gap-2 border border-ink bg-paper-raised px-3">
                    <span className="sr-only">{t("cases.search")}</span>
                    <input
                        type="search"
                        value={query}
                        maxLength={200}
                        onChange={(event) => onRouteChange({ query: event.target.value }, true)}
                        placeholder={t("cases.searchPlaceholder")}
                        className="min-h-10 w-full bg-transparent text-[15px] text-ink outline-offset-4 placeholder:text-text-muted"
                    />
                </label>
                <Segmented<CasesFilter>
                    label={t("cases.filter")}
                    value={filter}
                    onChange={(next) => onRouteChange({ filter: next })}
                    options={[
                        { value: "all", label: t("cases.filters.all") },
                        { value: "vote", label: t("cases.filters.vote", { count: waiting }) },
                        { value: "mine", label: t("cases.filters.mine") },
                    ]}
                />
            </div>

            {docket.status === "loading" && !data ? (
                <Deliberating>
                    <div className="grid gap-5 min-[900px]:grid-cols-4">
                        {COLUMNS.map((column) => (
                            <Skeleton key={column.state} className="h-56" />
                        ))}
                    </div>
                </Deliberating>
            ) : docket.status === "error" && !data ? (
                <Objection message={t("errors.load")} reassurance={t("caseDetail.safe")} technicalDetails={String(docket.error)} onRetry={docket.reload} />
            ) : data && data.cases.length === 0 ? (
                <EmptyState
                    message={t("cases.empty", { agent: agent.name })}
                    action={
                        viewer.canAct && !proposing ? (
                            <Button variant="secondary" onClick={() => setProposing(true)}>
                                {t("docket.propose")}
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <>
                    {visible.length === 0 && <EmptyState message={t("cases.noMatch")} />}
                    <div className="grid grid-cols-1 min-[900px]:grid-cols-4">
                        {COLUMNS.map(({ state, rule }, index) => {
                            const items = visible.filter((item) => item.analysis.state === state);
                            const open = expanded.has(state);
                            const shown = open ? items : items.slice(0, VISIBLE);
                            return (
                                <section
                                    key={state}
                                    aria-labelledby={`column-${state}`}
                                    className={cn("flex flex-col gap-3 pb-6 min-[900px]:px-4", index > 0 && "min-[900px]:border-l min-[900px]:border-rule", index === 0 && "min-[900px]:pl-0")}
                                >
                                    <header className={cn("flex items-start justify-between gap-2 border-b-[3px] pb-2", rule)}>
                                        <div>
                                            <h2 id={`column-${state}`} className="m-0 font-serif text-[24px] font-bold text-ink">
                                                {t(`caseState.${state}`)}
                                            </h2>
                                            <p className="m-0 text-[14px] text-text">{t(`cases.columns.${state}`)}</p>
                                        </div>
                                        <span className="font-mono text-[16px] font-bold text-ink">{items.length}</span>
                                    </header>
                                    {items.length === 0 && <p className="m-0 text-[14px] text-text-muted">{t("cases.columnEmpty")}</p>}
                                    {shown.map((item) => (
                                        <Clipping key={item.record.id} item={item} myUserId={viewer.me?.userId} onOpen={() => onOpenCase(item.record.id)} />
                                    ))}
                                    {items.length > VISIBLE && (
                                        <button
                                            type="button"
                                            onClick={() => setExpanded((previous) => new Set(previous).add(state))}
                                            hidden={open}
                                            className="min-h-11 w-fit text-left text-[15px] font-bold text-ink underline"
                                        >
                                            {t("cases.more", { count: items.length - VISIBLE })}
                                        </button>
                                    )}
                                </section>
                            );
                        })}
                    </div>
                    <p className="m-0 border-t border-rule pt-4 text-[14px] text-text">{t("cases.tip")}</p>
                </>
            )}
        </div>
    );
}

/** One case on the board: number · category, the question, and why it sits in this column. */
function Clipping({ item, myUserId, onOpen }: { item: DocketCase; myUserId?: string; onOpen: () => void }) {
    const { t } = useTranslation();
    const { record, analysis } = item;
    const state = analysis.state;
    const leading = Math.max(0, ...analysis.tallies.filter((tally) => tally.valid).map((tally) => tally.votesFor));
    const ruling = item.testimonies.find((testimony) => testimony.id === analysis.rulingTestimonyId);
    const rulingVotes = analysis.tallies.find((tally) => tally.testimony.id === analysis.rulingTestimonyId)?.votesFor ?? 0;
    const voted = Boolean(myUserId) && analysis.standingVotes.some((vote) => vote.voterUserId === myUserId);
    const dismissal = item.dismissals.find((row) => isValidDismissal(row, record, item.records.jurors, item.records.now));
    return (
        <a
            href={formatRoute({ page: "case", caseId: record.id })}
            onClick={(event) => {
                event.preventDefault();
                onOpen();
            }}
            className={cn(
                "flex flex-col gap-2 p-4 text-ink no-underline transition-[box-shadow,transform] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--ink)]",
                state === "disputed" ? "border-2 border-action bg-dispute-bg" : "border border-ink bg-paper-raised",
                state === "dismissed" && "border-dashed border-text-muted bg-transparent",
            )}
        >
            <span className="flex flex-wrap items-center gap-2 font-mono text-[13px] text-text">
                <CaseNumber id={record.id} className="text-[13px] text-text" /> · {record.category}
                {!analysis.verified && <UnverifiedChip />}
            </span>
            <span className={cn("font-serif text-[20px] font-bold leading-tight", state === "dismissed" && "text-text-muted line-through")}>
                {record.text}
            </span>
            {state === "under_review" && (
                <>
                    <span className="flex flex-wrap justify-between gap-2 text-[14px]">
                        <span className="text-text">{t("cases.votesOf", { count: leading, total: CONSENSUS_MIN_VOTES })}</span>
                        {item.needsMyVote ? (
                            <span className="font-semibold text-action-text">{t("cases.yourVote")}</span>
                        ) : voted ? (
                            <span className="text-text">{t("cases.youVoted")}</span>
                        ) : null}
                    </span>
                    <VoteBar value={leading} max={CONSENSUS_MIN_VOTES} tone="review" />
                </>
            )}
            {state === "disputed" && (
                <>
                    <span className="text-[14px] text-dispute-text">{t(`caseDetail.reason.${analysis.reason}`)}</span>
                    <span className="w-fit bg-action px-3 py-1.5 text-[14px] font-bold text-ink-inverse dark:text-ink">{t("docket.settle")}</span>
                </>
            )}
            {state === "ruled" && ruling && (
                <>
                    <span className="border-l-[3px] border-ruled pl-2.5 text-[15px] text-text">{ruling.answer}</span>
                    <span className="text-[14px] text-text">{t("cases.jurorsAgree", { count: rulingVotes })}</span>
                </>
            )}
            {state === "dismissed" && <span className="text-[14px] text-text">{dismissal?.reason ?? t("cases.dismissedHelp")}</span>}
        </a>
    );
}
