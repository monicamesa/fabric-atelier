import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { Chip } from "@/components/docket/chip";
import { Deliberating } from "@/components/docket/gavel";
import { SelectField } from "@/components/docket/field";
import { Objection } from "@/components/docket/objection";
import { PageHeader } from "@/components/docket/page-header";
import { CaseNumber } from "@/components/docket/status-chip";
import { EmptyState } from "@/components/docket/states";
import { runClerkAction } from "@/data/clerk.service";
import { describeClerkError, type ClerkErrorView } from "@/data/clerk-errors";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { loadHearingRecords } from "@/data/hearings.service";
import { useAsync } from "@/hooks/use-async";
import { isAppLanguage, type AppLanguage } from "@/i18n/language-preference";
import { formatDateTime } from "@/lib/format";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { HEARING_MAX_CASES, HEARING_STAGES, SECONDS_PER_QUESTION, estimateSeconds, type HearingStage } from "../../../rayfin/functions/src/hearing-rules";
import { ClerkError } from "../clerks-office/clerk-feedback";
import { AgentTabs } from "../docket/agent-tabs";
import type { DocketState } from "../docket/use-docket";
import { personName, type Viewer } from "../docket/viewer";
import { anyInSession, scoreboard, viewHearings } from "./hearing-view";

interface HearingsScreenProps {
    client: AppRayfinClient;
    agents: AgentRow[];
    agent: AgentRow;
    docket: DocketState;
    jurors: JurorRow[] | undefined;
    viewer: Viewer;
    onChangeAgent: (agentId: string) => void;
    onOpenHearing: (hearingId: string) => void;
}

/** Hearings of one agent, newest first, and (for admins) the form that starts the next one. */
export function HearingsScreen({ client, agents, agent, docket, jurors, viewer, onChangeAgent, onOpenHearing }: HearingsScreenProps) {
    const { t, i18n } = useTranslation();
    const language: AppLanguage = isAppLanguage(i18n.language) ? i18n.language : "en";
    const records = useAsync(() => loadHearingRecords(client));
    const [chosen, setChosen] = useState<string[]>([]);
    const [stage, setStage] = useState<HearingStage>("production");
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<ClerkErrorView | null>(null);

    const views = useMemo(() => (records.data ? viewHearings(records.data, new Date(), agent.id) : []), [records.data, agent.id]);
    const busy = records.data ? anyInSession(records.data, new Date()) : false;
    const ruled = useMemo(() => (docket.data?.cases ?? []).filter((item) => item.analysis.state === "ruled" && item.analysis.verified), [docket.data]);

    function toggle(caseId: string) {
        setChosen((current) =>
            current.includes(caseId) ? current.filter((id) => id !== caseId) : current.length >= HEARING_MAX_CASES ? current : [...current, caseId],
        );
    }

    async function start() {
        setStarting(true);
        setError(null);
        try {
            const result = await runClerkAction(client, "launchHearing", { agentId: agent.id, stage, caseIds: chosen });
            if (result.hearingId) onOpenHearing(result.hearingId);
            else records.reload();
        } catch (caught) {
            setError(describeClerkError(caught));
            records.reload();
        } finally {
            setStarting(false);
        }
    }

    const estimate = estimateSeconds(Math.max(chosen.length, 1));
    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                kicker={t("hearings.kicker")}
                title={t("hearings.title")}
                help={t("hearings.help")}
                aside={
                    <div className="flex flex-col items-start gap-3 min-[900px]:items-end">
                        <AgentTabs agents={agents} current={agent.id} onChange={onChangeAgent} />
                    </div>
                }
            />

            {viewer.isAdmin ? (
                <section aria-labelledby="launch-title" className="flex flex-col gap-4 border border-ink bg-paper-raised p-5">
                    <h2 id="launch-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                        {t("hearings.launch.title")}
                    </h2>
                    <p className="m-0 max-w-[700px] text-[16px] text-text">{t("hearings.launch.help")}</p>
                    {docket.status === "loading" && !docket.data ? (
                        <Deliberating>{t("loading.deliberating")}</Deliberating>
                    ) : ruled.length === 0 ? (
                        <EmptyState message={t("hearings.launch.noRuled")} />
                    ) : (
                        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                            <legend className="mb-2 text-[14px] font-semibold text-ink">
                                {t("hearings.launch.pick")} · {t("hearings.launch.selected", { count: chosen.length, max: HEARING_MAX_CASES })}
                            </legend>
                            {ruled.map((item) => {
                                const checked = chosen.includes(item.record.id);
                                const full = !checked && chosen.length >= HEARING_MAX_CASES;
                                const expected = item.testimonies.find((testimony) => testimony.id === item.analysis.rulingTestimonyId)?.answer;
                                return (
                                    <label
                                        key={item.record.id}
                                        className="flex min-h-11 cursor-pointer items-start gap-3 border border-rule bg-paper px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-ink min-[640px]:items-center"
                                    >
                                        <input type="checkbox" checked={checked} disabled={full} onChange={() => toggle(item.record.id)} className="mt-0.5 size-5 shrink-0 accent-[var(--ink)] min-[640px]:mt-0" />
                                        <span className="flex min-w-0 flex-1 flex-col gap-1 min-[640px]:flex-row min-[640px]:items-center min-[640px]:gap-3">
                                            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                                                <CaseNumber id={item.record.id} />
                                                <span className="font-serif text-[18px] font-bold text-ink">{item.record.text}</span>
                                            </span>
                                            {expected && (
                                                <span title={expected} className="max-w-full shrink-0 truncate font-mono text-[15px] text-text min-[640px]:max-w-[16rem]">
                                                    <span aria-hidden="true">→ </span>
                                                    <span className="sr-only">{t("hearings.launch.expected")} </span>
                                                    {expected}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>
                    )}
                    <div className="grid gap-4 min-[700px]:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                        <SelectField label={t("hearings.launch.stage")} value={stage} onChange={(value) => setStage(value as HearingStage)}>
                            {HEARING_STAGES.map((value) => (
                                <option key={value} value={value}>
                                    {t(`hearings.stage.${value}`)}
                                </option>
                            ))}
                        </SelectField>
                        <div className="flex flex-col gap-1 text-[14px] text-text">
                            <p className="m-0 font-semibold">
                                {t("hearings.launch.estimate", { count: Math.ceil(estimate / 60), seconds: SECONDS_PER_QUESTION })}
                            </p>
                            <p className="m-0 text-text-muted">{t("hearings.launch.capacity")}</p>
                        </div>
                    </div>
                    {busy && (
                        <p role="status" className="m-0 text-[15px] font-semibold text-action-text">
                            {t("hearings.launch.busy")}
                        </p>
                    )}
                    <ClerkError view={error} />
                    <div className="flex flex-col gap-2">
                        <div>
                            <Button
                                variant="primary"
                                disabled={starting || busy || chosen.length === 0}
                                aria-describedby={chosen.length === 0 ? "start-reason" : undefined}
                                onClick={() => void start()}
                            >
                                {starting ? t("hearings.launch.starting") : t("hearings.launch.submit")}
                            </Button>
                        </div>
                        {chosen.length === 0 && (
                            <p id="start-reason" className="m-0 text-[14px] text-text-muted">
                                {t("hearings.launch.chooseOne")}
                            </p>
                        )}
                    </div>
                </section>
            ) : (
                <p className="m-0 text-[15px] text-text-muted">{t("hearings.launch.adminOnly")}</p>
            )}

            <section aria-labelledby="list-title" className="flex flex-col gap-3">
                <h2 id="list-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                    {t("hearings.list.title")}
                </h2>
                {records.status === "error" && !records.data && (
                    <Objection message={t("errors.load")} technicalDetails={String(records.error)} onRetry={records.reload} />
                )}
                {!records.data && records.status !== "error" && <Deliberating>{t("loading.readingRecord")}</Deliberating>}
                {records.data && views.length === 0 && <EmptyState message={viewer.isAdmin ? t("hearings.list.none") : t("hearings.list.noneViewer")} />}
                <ul className="m-0 flex list-none flex-col divide-y divide-rule border-y border-ink p-0">
                    {views.map((view) => {
                        const score = scoreboard(view.verdicts);
                        return (
                            <li key={view.hearing.id} className="grid gap-3 py-4 min-[900px]:grid-cols-[minmax(0,1fr)_auto] min-[900px]:items-center">
                                <div className="flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Chip tone={view.state === "in_progress" ? "action" : view.state === "completed" ? "ruled" : view.state === "no_news" ? "review" : "muted"} filled={view.state === "in_progress" || view.state === "completed"}>
                                            {t(`hearings.state.${view.state}`)}
                                        </Chip>
                                        <span className="text-[15px] text-text">
                                            {t("hearings.list.startedBy", {
                                                when: formatDateTime(view.hearing.createdAt, language),
                                                who: jurors ? personName(view.hearing.launchedByEmail, jurors) : "",
                                            })}
                                        </span>
                                    </div>
                                    <p className="m-0 text-[14px] text-text-muted">
                                        {t(`hearings.stage.${view.hearing.stage}`)} · {t("hearings.list.questions", { count: view.total })} ·{" "}
                                        {(["correct", "incorrect", "unclear"] as const).map((key) => t(`hearings.list.score.${key}`, { count: score[key] })).join(" · ")}
                                    </p>
                                </div>
                                <Button variant="secondary" compact onClick={() => onOpenHearing(view.hearing.id)}>
                                    {t("hearings.list.open")}
                                </Button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
