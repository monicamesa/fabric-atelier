import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip, type ChipTone } from "@/components/docket/chip";
import { Deliberating } from "@/components/docket/gavel";
import { Objection } from "@/components/docket/objection";
import { PageHeader } from "@/components/docket/page-header";
import { Stamp } from "@/components/docket/stamp";
import { CaseNumber } from "@/components/docket/status-chip";
import { EmptyState } from "@/components/docket/states";
import { runClerkAction } from "@/data/clerk.service";
import { describeClerkError, type ClerkErrorView } from "@/data/clerk-errors";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { loadHearingRecords, type VerdictRow } from "@/data/hearings.service";
import { useAsync } from "@/hooks/use-async";
import { useClerkAction } from "@/hooks/use-clerk-action";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";
import { formatDateTime } from "@/lib/format";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { ClerkError } from "../clerks-office/clerk-feedback";
import { personName, type Viewer } from "../docket/viewer";
import { questionFor, scoreboard, viewHearing, type HearingView } from "./hearing-view";
import { SessionPanel } from "./session-panel";
import { useAutoRefresh } from "./use-auto-refresh";

const STATE_TONE: Record<HearingView["state"], { tone: ChipTone; filled: boolean }> = {
    in_progress: { tone: "action", filled: true },
    completed: { tone: "ruled", filled: true },
    failed: { tone: "action", filled: false },
    cancelled: { tone: "muted", filled: false },
    no_news: { tone: "review", filled: false },
};

function VerdictCard({ view, verdict, language }: { view: HearingView; verdict: VerdictRow; language: AppLanguage }) {
    const { t } = useTranslation();
    const asked = questionFor(view, verdict);
    const position = asked?.position ?? 0;
    return (
        <article className="flex flex-col gap-4 border border-ink bg-paper-raised p-5">
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
                    <p className="m-0 whitespace-pre-line text-[17px] text-text">{verdict.agentAnswer}</p>
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
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                kicker={`${t("hearings.kicker")} · ${agentName}`}
                title={t("hearings.title")}
                help={t("hearings.help")}
                aside={
                    <div className="flex flex-col items-start gap-2 min-[900px]:items-end">
                        <Chip tone={tone.tone} filled={tone.filled}>
                            {t(`hearings.state.${view.state}`)}
                        </Chip>
                        <p className="m-0 text-[14px] text-text-muted">
                            {t("hearings.list.startedBy", {
                                when: formatDateTime(view.hearing.createdAt, language),
                                who: jurors ? personName(view.hearing.launchedByEmail, jurors) : "",
                            })}
                        </p>
                        <p className="m-0 text-[14px] text-text-muted">
                            {t(`hearings.stage.${view.hearing.stage}`)} · {t("hearings.list.questions", { count: view.total })}
                        </p>
                    </div>
                }
            />

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
                                <dt className="order-2 text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted">{t(`hearings.scoreboard.${key}`)}</dt>
                                <dd className="m-0 font-serif text-[40px] font-black leading-none text-ink">{score[key]}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
                {view.verdicts.length === 0 && <EmptyState message={t("hearings.verdicts.empty")} />}
                {view.cases.map((row) => {
                    const verdict = view.verdicts.find((item) => item.case_id.toLowerCase() === row.case_id.toLowerCase());
                    if (verdict) return <VerdictCard key={row.id} view={view} verdict={verdict} language={language} />;
                    if (running && nextWaiting?.id === row.id) {
                        return (
                            <p key={row.id} role="status" className="m-0 border border-dashed border-text-muted p-4 text-[15px] text-text-muted">
                                {t("hearings.verdicts.waiting")} <span className="font-serif font-bold text-ink">{row.question}</span>
                            </p>
                        );
                    }
                    return null;
                })}
                <p className="m-0 text-[14px] text-text-muted">{t("hearings.verdicts.reviewSoon")}</p>
            </section>
        </div>
    );
}
