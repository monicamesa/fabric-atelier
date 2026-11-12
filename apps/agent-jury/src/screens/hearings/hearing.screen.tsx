import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip, type ChipTone } from "@/components/docket/chip";
import { Deliberating } from "@/components/docket/gavel";
import { Objection } from "@/components/docket/objection";
import { Stamp } from "@/components/docket/stamp";
import { CaseNumber } from "@/components/docket/status-chip";
import { EmptyState } from "@/components/docket/states";
import { runClerkAction } from "@/data/clerk.service";
import { describeClerkError, type ClerkErrorView } from "@/data/clerk-errors";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { loadHearingRecords, type VerdictRow } from "@/data/hearings.service";
import { createVerdictReview } from "@/data/reviews.service";
import { useAsync } from "@/hooks/use-async";
import { useClerkAction } from "@/hooks/use-clerk-action";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";
import { formatDateTime } from "@/lib/format";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { formatRoute } from "@/lib/route";
import { cn } from "@/lib/utils";
import { criticPromptVersionOf, judgeTrust } from "@/rules/judge-trust";
import { ClerkError } from "../clerks-office/clerk-feedback";
import { personName, type Viewer } from "../docket/viewer";
import { questionFor, scoreboard, viewHearing, type HearingView } from "./hearing-view";
import { AgentAnswer } from "./agent-answer";
import { agreementFor, type AppealInput } from "./review-choices";
import { SessionPanel } from "./session-panel";
import { useAutoRefresh } from "./use-auto-refresh";
import { VerdictReviewPanel } from "./verdict-review";

const STATE_TONE: Record<HearingView["state"], { tone: ChipTone; filled: boolean }> = {
    in_progress: { tone: "action", filled: true },
    completed: { tone: "ruled", filled: true },
    failed: { tone: "action", filled: false },
    cancelled: { tone: "muted", filled: false },
    no_news: { tone: "review", filled: false },
};

function VerdictCard({
    view,
    verdict,
    language,
    active,
    children,
}: {
    view: HearingView;
    verdict: VerdictRow;
    language: AppLanguage;
    active: boolean;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const asked = questionFor(view, verdict);
    const position = asked?.position ?? 0;
    return (
        <article aria-current={active ? "true" : undefined} data-verdict-id={verdict.id} className={cn("flex flex-col gap-4 border bg-paper-raised p-5", active ? "border-2 border-ink" : "border-ink")}>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-text-muted">
                    {t("hearings.verdicts.position", { position, total: view.total, number: "" })}
                    <CaseNumber id={verdict.case_id} className="ml-1" />
                </span>
                <Stamp tone={verdict.judgeVerdict}>{t(`hearings.verdicts.${verdict.judgeVerdict}`)}</Stamp>
            </header>
            <h3 className="m-0 font-serif text-[22px] font-bold leading-snug text-ink">{asked?.question}</h3>
            <div className="grid gap-4 min-[700px]:grid-cols-2">
                <div className="flex flex-col gap-1 border-l-4 border-ruled pl-3">
                    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-text-muted">{t("hearings.verdicts.expects")}</span>
                    <p className="m-0 font-serif text-[20px] font-bold text-ink">{asked?.expectedAnswer}</p>
                </div>
                <div className="flex flex-col gap-1 border-l-4 border-ink pl-3">
                    <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-text-muted">{t("hearings.verdicts.answered")}</span>
                    <AgentAnswer text={verdict.agentAnswer} />
                </div>
            </div>
            {verdict.dataAgentVersion && (
                <p className="m-0 font-mono text-[13px] text-text-muted">
                    {t("hearings.verdicts.agentVersion", {
                        version: verdict.dataAgentVersion,
                        when: verdict.dataAgentLastUpdated ? formatDateTime(verdict.dataAgentLastUpdated, language) : "–",
                    })}
                </p>
            )}
            {children}
        </article>
    );
}

interface HearingScreenProps {
    client: AppRayfinClient;
    hearingId: string;
    agents: AgentRow[] | undefined;
    jurors: JurorRow[] | undefined;
    viewer: Viewer;
    onBack: () => void;
}

/** One hearing: the "in session" state while it runs, then the verdicts as they arrive (live hearing, design guide). */
export function HearingScreen({ client, hearingId, agents, jurors, viewer, onBack }: HearingScreenProps) {
    const { t, i18n } = useTranslation();
    const language: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";
    const records = useAsync(() => loadHearingRecords(client));
    const [readAt, setReadAt] = useState(() => new Date());
    const view = useMemo(() => {
        const hearing = records.data?.hearings.find((row) => row.id.toLowerCase() === hearingId.toLowerCase());
        const now = new Date();
        return records.data && hearing ? viewHearing(hearing, records.data, now) : undefined;
        // The page is re-derived whenever new records arrive.
    }, [records.data, hearingId]);
    const running = view?.state === "in_progress";
    const reload = () => {
        setReadAt(new Date());
        records.reload();
    };
    const { refresh, stopped } = useAutoRefresh(Boolean(running), reload);
    const action = useClerkAction(client, reload);
    const [reported, setReported] = useState<string | null>(null);
    const [checkError, setCheckError] = useState<ClerkErrorView | null>(null);
    const [checking, setChecking] = useState(false);
    const [activeId, setActiveId] = useState<string>();
    const [appealingId, setAppealingId] = useState<string>();
    const [reviewing, setReviewing] = useState(false);
    const [reviewFailed, setReviewFailed] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

    const orderedVerdicts = useMemo(
        () =>
            view
                ? view.cases.flatMap((row) => {
                      const found = view.verdicts.find((item) => item.case_id.toLowerCase() === row.case_id.toLowerCase());
                      return found ? [found] : [];
                  })
                : [],
        [view],
    );
    const trust = useMemo(
        () =>
            view && records.data
                ? judgeTrust({
                      agentId: view.hearing.agent_id,
                      hearings: records.data.hearings,
                      verdicts: records.data.verdicts,
                      reviewRecords: { verdicts: records.data.verdicts, hearingCases: records.data.cases, reviews: records.data.reviews },
                      jurors: jurors ?? [],
                      now: new Date(),
                  })
                : undefined,
        [view, records.data, jurors],
    );

    async function saveReview(verdict: VerdictRow, input: { humanVerdict: AppealInput["humanVerdict"]; reason?: AppealInput["reason"]; comment?: string }) {
        setReviewing(true);
        setReviewFailed(false);
        try {
            await createVerdictReview(client, { verdictId: verdict.id, ...input });
            setAppealingId(undefined);
            reload();
        } catch {
            setReviewFailed(true);
        } finally {
            setReviewing(false);
        }
    }
    const agree = (verdict: VerdictRow) => {
        if (viewer.canAct && !reviewing) void saveReview(verdict, { humanVerdict: agreementFor(verdict.judgeVerdict) });
    };

    // Keyboard on the live hearing (design guide, section 9): A agree, X appeal, J/K previous/next, ? help.
    const onKey = useEffectEvent((event: KeyboardEvent) => {
        if (event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target;
        if (target instanceof HTMLElement && (target.closest("input, textarea, select") || target.isContentEditable)) return;
        const index = orderedVerdicts.findIndex((item) => item.id === activeId);
        const current = orderedVerdicts[index];
        const move = (next: number) => {
            const item = orderedVerdicts[Math.max(0, Math.min(orderedVerdicts.length - 1, next))];
            if (!item) return;
            setActiveId(item.id);
            document.querySelector(`[data-verdict-id="${item.id}"]`)?.scrollIntoView?.({ block: "nearest" });
        };
        switch (event.key.toLowerCase()) {
            case "j":
                move(index + 1);
                break;
            case "k":
                move(index < 0 ? 0 : index - 1);
                break;
            case "a":
                if (current) agree(current);
                break;
            case "x":
                if (current && viewer.canAct) setAppealingId(current.id);
                break;
            case "?":
                setShowKeys((value) => !value);
                break;
        }
    });
    useEffect(() => {
        const handler = (event: KeyboardEvent) => onKey(event);
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    if (!view) {
        if (records.status === "error") {
            return <Objection message={t("errors.load")} technicalDetails={String(records.error)} onRetry={records.reload} />;
        }
        if (records.data) {
            return (
                <EmptyState
                    message={t("hearings.notFound")}
                    action={
                        <Button variant="secondary" onClick={onBack}>
                            {t("hearings.back")}
                        </Button>
                    }
                />
            );
        }
        return <Deliberating>{t("loading.readingRecord")}</Deliberating>;
    }

    const agent = agents?.find((row) => row.id.toLowerCase() === view.hearing.agent_id.toLowerCase());
    const agentName = agent?.name ?? "—";
    const score = scoreboard(view.verdicts);
    const nextWaiting = view.cases.find((row) => !view.verdicts.some((verdict) => verdict.case_id.toLowerCase() === row.case_id.toLowerCase()));
    const canAct = viewer.isAdmin && (view.state === "in_progress" || view.state === "no_news");

    async function checkWithFabric() {
        setChecking(true);
        setCheckError(null);
        setReported(null);
        try {
            const result = await runClerkAction(client, "checkWithFabric", { hearingId: view!.hearing.id });
            setReported(result.jobStatus ?? "");
            reload();
        } catch (error) {
            setCheckError(describeClerkError(error));
        } finally {
            setChecking(false);
        }
    }

    const tone = STATE_TONE[view.state];
    const hearingTrust = trust?.byHearing[view.hearing.id];
    return (
        <div className="flex flex-col gap-6">
            <a href={formatRoute({ page: "hearings", agentId: view.hearing.agent_id })} className="w-fit text-[15px] font-semibold text-ink underline">
                {t("hearings.detail.all")}
            </a>
            <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-6 border-b-[6px] border-double border-ink pb-5 min-[900px]:grid-cols-[minmax(0,1fr)_380px] min-[900px]:gap-10">
                <div className="flex flex-col gap-2">
                    <h1 className="m-0 font-serif text-[34px] font-black leading-[1.05] tracking-[-0.02em] text-ink min-[900px]:text-[44px]">
                        {t("hearings.detail.title", { when: formatDateTime(view.hearing.createdAt, language), agent: agentName })}
                    </h1>
                    <p className="m-0 max-w-[700px] text-[17px] leading-normal text-text">{t("hearings.detail.help")}</p>
                </div>
                <div className="flex flex-col items-start gap-2 min-[900px]:items-end">
                    <Chip tone={tone.tone} filled={tone.filled}>
                        {t(`hearings.state.${view.state}`)}
                    </Chip>
                    <p className="m-0 text-[14px] text-text-muted">
                        {t("hearings.detail.startedBy", { who: jurors ? personName(view.hearing.launchedByEmail, jurors) : "" })}
                    </p>
                    <p className="m-0 text-[14px] text-text-muted">
                        {t(`hearings.stage.${view.hearing.stage}`)} · {t("hearings.list.questions", { count: view.total })}
                    </p>
                </div>
            </div>

            {running && <SessionPanel view={view} agentName={agentName} onLeave={onBack} />}
            {view.state === "completed" && (
                <p role="status" className="m-0 text-[17px] font-semibold text-ruled">
                    {t("hearings.ended.completed", { count: view.verdicts.length })}
                </p>
            )}
            {view.state === "failed" && (
                <Objection message={t("hearings.ended.failed", { detail: "" })} technicalDetails={view.failedDetail} compact />
            )}
            {view.state === "cancelled" && <p className="m-0 text-[16px] text-text">{t("hearings.ended.cancelled")}</p>}
            {view.state === "no_news" && <Objection message={t("hearings.ended.no_news")} compact />}

            <div className="flex flex-wrap items-center gap-3 border-y border-rule py-3">
                <Button variant="secondary" compact onClick={refresh} disabled={records.status === "loading"}>
                    {t("hearings.refresh.button")}
                </Button>
                <span className="text-[14px] text-text-muted">{t("hearings.refresh.lastRead", { time: formatDateTime(readAt, language) })}</span>
                {running && <span className="text-[14px] text-text-muted">{stopped ? t("hearings.refresh.paused") : t("hearings.refresh.auto")}</span>}
                {canAct && (
                    <div className="ml-auto flex flex-wrap items-center gap-3">
                        {(view.state === "no_news" || view.overtime) && (
                            <Button variant="quiet" compact disabled={checking} onClick={() => void checkWithFabric()} title={t("hearings.actions.checkHelp")}>
                                {checking ? t("hearings.actions.checking") : t("hearings.actions.check")}
                            </Button>
                        )}
                        <Button
                            variant="danger-text"
                            compact
                            disabled={action.pending}
                            onClick={() => void action.run("cancelHearing", { hearingId: view.hearing.id })}
                        >
                            {action.pending ? t("hearings.actions.cancelling") : t("hearings.actions.cancel")}
                        </Button>
                    </div>
                )}
            </div>
            {reported !== null && (
                <p role="status" className="m-0 text-[15px] font-semibold text-ruled">
                    {t("hearings.actions.reported", { status: reported || "?" })}
                </p>
            )}
            <ClerkError view={action.error ?? checkError} />

            <section aria-labelledby="verdicts-title" className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <h2 id="verdicts-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                        {t("hearings.verdicts.title")}
                    </h2>
                    <dl className="m-0 flex gap-5" aria-label={t("hearings.scoreboard.title")}>
                        {(["correct", "incorrect", "unclear"] as const).map((key) => (
                            <div key={key} className="flex flex-col items-center">
                                <dt className="order-2 text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted">{t(`hearings.scoreboard.${key}`, { count: score[key] })}</dt>
                                <dd className="m-0 font-serif text-[40px] font-black leading-none text-ink">{score[key]}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
                {hearingTrust && (
                    <p role="status" className="m-0 border-l-4 border-ruled pl-3 text-[15px] text-text">
                        {hearingTrust.decided > 0
                            ? t("hearings.review.hearingTrust", { agreed: hearingTrust.agreed, decided: hearingTrust.decided })
                            : t("hearings.review.hearingTrustNone")}
                        {hearingTrust.pending > 0 && <span className="text-text-muted"> · {t("hearings.review.hearingPending", { count: hearingTrust.pending })}</span>}
                        <span className="text-text-muted"> · {t("hearings.review.judgePrompt", { version: criticPromptVersionOf(view.hearing) })}</span>
                    </p>
                )}
                {view.verdicts.length === 0 && <EmptyState message={t("hearings.verdicts.empty")} />}
                {view.cases.map((row) => {
                    const verdict = view.verdicts.find((item) => item.case_id.toLowerCase() === row.case_id.toLowerCase());
                    if (verdict) {
                        return (
                            <VerdictCard key={row.id} view={view} verdict={verdict} language={language} active={verdict.id === activeId}>
                                <VerdictReviewPanel
                                    verdict={verdict}
                                    reviews={records.data?.reviews ?? []}
                                    jurors={jurors ?? []}
                                    viewer={viewer}
                                    appealing={appealingId === verdict.id}
                                    saving={reviewing}
                                    failed={reviewFailed && (appealingId === verdict.id || activeId === verdict.id)}
                                    onAppealingChange={(open) => {
                                        setActiveId(verdict.id);
                                        setAppealingId(open ? verdict.id : undefined);
                                    }}
                                    onAgree={() => {
                                        setActiveId(verdict.id);
                                        agree(verdict);
                                    }}
                                    onAppeal={(input) => {
                                        setActiveId(verdict.id);
                                        void saveReview(verdict, input);
                                    }}
                                />
                            </VerdictCard>
                        );
                    }
                    if (running && nextWaiting?.id === row.id) {
                        return (
                            <p key={row.id} role="status" className="m-0 border border-dashed border-text-muted p-4 text-[15px] text-text-muted">
                                {t("hearings.verdicts.waiting")} <span className="font-serif font-bold text-ink">{row.question}</span>
                            </p>
                        );
                    }
                    return null;
                })}
                {view.verdicts.length > 0 && (
                    <p className="m-0 text-[14px] text-text-muted">
                        {t("hearings.review.keys")}
                        {showKeys && <span> {t("hearings.review.keysHelp")}</span>}
                    </p>
                )}
            </section>
        </div>
    );
}
