import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Deliberating } from "@/components/docket/gavel";
import { Glossary } from "@/components/docket/glossary";
import { JudgeTrustPlaceholder } from "@/components/docket/judge-trust";
import { Objection } from "@/components/docket/objection";
import { CaseNumber, StatusChip, UnverifiedChip } from "@/components/docket/status-chip";
import { EmptyState, Skeleton } from "@/components/docket/states";
import type { AgentRow } from "@/data/directory.service";
import type { DocketCase } from "@/data/docket";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { formatRoute } from "@/lib/route";
import { CONSENSUS_MIN_VOTES } from "@/rules/consensus";
import { AgentTabs } from "../docket/agent-tabs";
import { homeRows } from "../docket/docket-views";
import { ProposeCaseForm } from "../docket/propose-case-form";
import type { DocketState } from "../docket/use-docket";
import type { Viewer } from "../docket/viewer";

interface HomeScreenProps {
    client: AppRayfinClient;
    agents: AgentRow[];
    agent?: AgentRow;
    docket?: DocketState;
    viewer: Viewer;
    onAgentChange: (agentId: string) => void;
    onOpenCase: (caseId: string) => void;
    onOpenClerk: () => void;
}

export function HomeScreen({ client, agents, agent, docket, viewer, onAgentChange, onOpenCase, onOpenClerk }: HomeScreenProps) {
    const { t } = useTranslation();
    const [proposing, setProposing] = useState(false);
    const data = docket?.data;
    const waiting = data?.cases.filter((item) => item.needsMyVote).length ?? 0;

    return (
        <div className="flex flex-col gap-8">
            <section className="grid gap-8 border-b-[6px] border-double border-ink pb-7 min-[900px]:grid-cols-[minmax(0,1fr)_340px] min-[900px]:items-center">
                <div className="flex flex-col gap-5">
                    <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-action-text">{t("home.kicker")}</span>
                    <h1 className="m-0 max-w-[700px] font-serif text-[56px] font-black leading-[0.9] tracking-[-0.04em] text-ink min-[900px]:text-[104px]">
                        {t("home.title")}
                    </h1>
                    <p className="m-0 max-w-[680px] font-serif text-[20px] leading-snug text-text min-[900px]:text-[24px]">{t("home.lead")}</p>
                    <div className="flex flex-wrap items-center gap-5">
                        {viewer.canAct && agent && !proposing && (
                            <Button variant="primary" onClick={() => setProposing(true)}>
                                {t("docket.propose")}
                            </Button>
                        )}
                        {waiting > 0 && agent && (
                            <a href={formatRoute({ page: "cases", agentId: agent.id, filter: "vote", query: "" })} className="text-[16px] font-bold text-action-text underline">
                                {t("home.needYourVote", { count: waiting })}
                            </a>
                        )}
                    </div>
                </div>
                <JudgeTrustPlaceholder />
            </section>

            {proposing && agent && (
                <ProposeCaseForm
                    client={client}
                    agentId={agent.id}
                    agentName={agent.name}
                    categories={data?.categories ?? []}
                    onCancel={() => setProposing(false)}
                    onSaved={onOpenCase}
                />
            )}

            <Glossary />

            <section aria-labelledby="docket-title" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-3">
                    <div>
                        <h2 id="docket-title" className="m-0 font-serif text-[32px] font-bold text-ink">
                            {t("home.docketTitle")}
                        </h2>
                        <p className="m-0 text-[15px] text-text">{t("home.docketHelp")}</p>
                    </div>
                    {agent && <AgentTabs agents={agents} current={agent.id} onChange={onAgentChange} />}
                </div>
                {!viewer.canAct && <p className="m-0 border-l-4 border-review pl-3 text-[15px] text-text">{t("docket.readOnly")}</p>}
                {!agent ? (
                    <EmptyState
                        message={t("home.noAgents")}
                        action={
                            viewer.isAdmin ? (
                                <Button variant="secondary" onClick={onOpenClerk}>
                                    {t("home.openClerk")}
                                </Button>
                            ) : undefined
                        }
                    />
                ) : docket?.status === "loading" && !data ? (
                    <Deliberating>
                        {[0, 1, 2].map((key) => (
                            <Skeleton key={key} className="h-16" />
                        ))}
                    </Deliberating>
                ) : docket?.status === "error" && !data ? (
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
                ) : data ? (
                    <>
                        <div role="table" aria-labelledby="docket-title" className="flex flex-col">
                            <div role="row" className="hidden grid-cols-[72px_minmax(0,1fr)_220px] gap-4 border-b border-rule px-2 pb-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink min-[700px]:grid">
                                <span role="columnheader">{t("home.columns.case")}</span>
                                <span role="columnheader">{t("home.columns.question")}</span>
                                <span role="columnheader" className="text-right">
                                    {t("home.columns.status")}
                                </span>
                            </div>
                            {homeRows(data.cases).map((item) => (
                                <DocketRow key={item.record.id} item={item} onOpen={() => onOpenCase(item.record.id)} />
                            ))}
                        </div>
                        <a href={formatRoute({ page: "cases", agentId: agent.id, filter: "all", query: "" })} className="w-fit text-[16px] font-bold text-ink underline">
                            {t("home.seeAll", { count: data.cases.length })}
                        </a>
                    </>
                ) : null}
            </section>
        </div>
    );
}

function DocketRow({ item, onOpen }: { item: DocketCase; onOpen: () => void }) {
    const { t } = useTranslation();
    const { record, analysis } = item;
    const ruling = item.testimonies.find((testimony) => testimony.id === analysis.rulingTestimonyId);
    const rulingVotes = analysis.tallies.find((tally) => tally.testimony.id === analysis.rulingTestimonyId)?.votesFor ?? 0;
    const leading = Math.max(0, ...analysis.tallies.filter((tally) => tally.valid).map((tally) => tally.votesFor));
    const helper =
        analysis.state === "ruled" && ruling
            ? t("home.expected", { answer: ruling.answer })
            : analysis.state === "under_review" && analysis.reason !== "noAnswers"
              ? t("cases.votesOf", { count: leading, total: CONSENSUS_MIN_VOTES })
              : t(`caseDetail.reason.${analysis.reason}`, { count: analysis.votesMissing, total: CONSENSUS_MIN_VOTES });
    const href = formatRoute({ page: "case", caseId: record.id });
    const go = (event: MouseEvent) => {
        event.preventDefault();
        onOpen();
    };
    return (
        <div role="row" className="grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-rule px-2 py-4 min-[700px]:grid-cols-[72px_minmax(0,1fr)_220px] min-[700px]:items-center">
            <span role="cell">
                <CaseNumber id={record.id} />
            </span>
            <span role="cell" className="flex min-w-0 flex-col gap-1">
                <a href={href} onClick={go} className="font-serif text-[21px] leading-tight text-ink no-underline hover:underline">
                    {record.text}
                </a>
                <span className="truncate text-[14px] text-text">{helper}</span>
            </span>
            <span role="cell" className="col-start-2 flex flex-wrap items-center gap-2 min-[700px]:col-start-3 min-[700px]:flex-col min-[700px]:items-end">
                <span className="flex flex-wrap items-center gap-2">
                    {!analysis.verified && <UnverifiedChip />}
                    <StatusChip state={analysis.state} />
                </span>
                {analysis.state === "disputed" ? (
                    <a href={href} onClick={go} className="inline-flex min-h-11 items-center bg-action px-4 text-[15px] font-bold text-ink-inverse no-underline dark:text-ink">
                        {t("docket.settle")}
                    </a>
                ) : analysis.state === "ruled" ? (
                    <span className="text-[14px] text-text">{t("cases.jurorsAgree", { count: rulingVotes })}</span>
                ) : item.needsMyVote ? (
                    <a href={href} onClick={go} className="inline-flex min-h-11 items-center border-2 border-ink px-4 text-[15px] font-bold text-ink no-underline hover:bg-paper-hover">
                        {t("docket.castVote")}
                    </a>
                ) : null}
            </span>
        </div>
    );
}
