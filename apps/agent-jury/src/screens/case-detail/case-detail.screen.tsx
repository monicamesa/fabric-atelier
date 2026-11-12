import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/docket/button";
import { TextAreaField } from "@/components/docket/field";
import { Deliberating } from "@/components/docket/gavel";
import { Objection } from "@/components/docket/objection";
import { CaseNumber, StatusChip, UnverifiedChip } from "@/components/docket/status-chip";
import { EmptyState, Skeleton } from "@/components/docket/states";
import { createCaseDismissal, createVote } from "@/data/cases.service";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { buildDocket, loadCaseRecords } from "@/data/docket";
import { useAsync } from "@/hooks/use-async";
import { isAppLanguage } from "@/i18n/language-preference";
import { formatDate } from "@/lib/format";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { formatRoute } from "@/lib/route";
import { caseEvents, isValidDismissal, type VoteValue } from "@/rules/case-validity";
import { CONSENSUS_MIN_VOTES } from "@/rules/consensus";
import { answerLetter, personName, personTeam, type Viewer } from "../docket/viewer";
import { AnswerForm } from "../docket/answer-form";
import { CourtRecord } from "./court-record";
import { DiffTable } from "./diff-table";
import { TestimonyCard } from "./testimony-card";

interface CaseDetailProps {
    client: AppRayfinClient;
    caseId: string;
    agents?: readonly AgentRow[];
    jurors?: readonly JurorRow[];
    viewer: Viewer;
}

export function CaseDetail({ client, caseId, agents, jurors, viewer }: CaseDetailProps) {
    const { t, i18n } = useTranslation();
    const language = isAppLanguage(i18n.language) ? i18n.language : "en";
    const records = useAsync(() => loadCaseRecords(client, caseId));
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<unknown>();
    const [notice, setNotice] = useState("");
    const [panel, setPanel] = useState<"none" | "answer" | "dismiss">("none");
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState<string>();

    const view = useMemo(() => {
        if (!records.data || !jurors) return undefined;
        const now = new Date();
        const docket = buildDocket(records.data, jurors, viewer.me, now);
        return { now, item: docket.cases[0] };
    }, [records.data, jurors, viewer.me]);

    if ((records.status === "loading" && !records.data) || (records.status !== "error" && (!jurors || !agents))) {
        return (
            <Deliberating>
                <Skeleton className="h-14 w-3/4" />
                <div className="grid gap-5 min-[900px]:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </Deliberating>
        );
    }
    if (records.status === "error" && !records.data) {
        return <Objection message={t("errors.load")} reassurance={t("caseDetail.safe")} technicalDetails={String(records.error)} onRetry={records.reload} />;
    }
    if (!view || !jurors) {
        return (
            <EmptyState
                message={t("caseDetail.notFound")}
                action={
                    <a href={formatRoute({ page: "cases", filter: "all", query: "" })} className="font-bold text-action-text">
                        {t("caseDetail.back")}
                    </a>
                }
            />
        );
    }

    const { item, now } = view;
    const { record, analysis } = item;
    const agent = agents?.find((row) => row.id === record.agent_id);
    const letters = new Map(analysis.tallies.map((tally, index) => [tally.testimony.id, answerLetter(index)]));
    const testimonyById = new Map(item.testimonies.map((testimony) => [testimony.id, testimony]));
    const open = analysis.state !== "dismissed";
    const isAuthor = viewer.me?.userId === record.authorUserId;
    const myVotes = new Map(
        analysis.standingVotes.filter((vote) => vote.voterUserId === viewer.me?.userId).map((vote) => [vote.testimony_id, vote.value]),
    );
    const leading = [...analysis.tallies].filter((tally) => tally.valid).sort((a, b) => b.votesFor - a.votesFor)[0];
    const compared = [...analysis.tallies]
        .filter((tally) => tally.valid)
        .sort((a, b) => b.votesFor - a.votesFor)
        .slice(0, 2)
        .sort((a, b) => letters.get(a.testimony.id)!.localeCompare(letters.get(b.testimony.id)!));
    const dismissal = item.dismissals.find((row) => isValidDismissal(row, record, jurors, now));
    const myVoteLetter = [...myVotes.entries()].map(([id, value]) => ({ letter: letters.get(id), value }))[0];

    async function act(run: () => Promise<unknown>, done: string): Promise<boolean> {
        setBusy(true);
        setFailure(undefined);
        setNotice("");
        try {
            await run();
            setNotice(done);
            records.reload();
            return true;
        } catch (error) {
            setFailure(error);
            return false;
        } finally {
            setBusy(false);
        }
    }

    const vote = (testimonyId: string, letter: string) => (value: VoteValue, comment?: string) =>
        act(() => createVote(client, { testimonyId, value, comment }), t(value === "for" ? "vote.doneFor" : "vote.doneAgainst", { letter }));

    async function dismiss(event: FormEvent) {
        event.preventDefault();
        if (!reason.trim()) {
            setReasonError(t("dismiss.reasonRequired"));
            return;
        }
        setReasonError(undefined);
        if (await act(() => createCaseDismissal(client, { caseId: record.id, reason: reason.trim() }), t("dismiss.done"))) {
            setPanel("none");
            setReason("");
        }
    }

    const backRoute = formatRoute({ page: "cases", agentId: record.agent_id, filter: "all", query: "" });
    const answersTitle =
        analysis.tallies.length === 0 ? t("caseDetail.noAnswersTitle") : t("caseDetail.answersTitle", { count: analysis.tallies.length });
    const addAnswerLabel =
        analysis.tallies.length === 0 ? (isAuthor ? t("caseDetail.addYourAnswer") : t("caseDetail.addFirstAnswer")) : t("caseDetail.addAnotherAnswer");

    return (
        <article className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
                <a href={backRoute} className="w-fit text-[15px] font-semibold text-ink underline">
                    {t("caseDetail.back")}
                </a>
                <div className="grid gap-6 border-b-[6px] border-double border-ink pb-5 min-[900px]:grid-cols-[minmax(0,1fr)_300px] min-[900px]:items-end">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-[15px] text-text">
                                <CaseNumber id={record.id} className="text-[15px] text-text" /> · {agent?.name ?? t("caseDetail.unknownAgent")}
                            </span>
                            <StatusChip state={analysis.state} />
                            {!analysis.verified && <UnverifiedChip />}
                        </div>
                        <h1 className="m-0 max-w-[960px] font-serif text-[36px] font-black leading-[1.02] tracking-[-0.02em] text-ink min-[900px]:text-[56px]">
                            {record.text}
                        </h1>
                        <p className="m-0 max-w-[760px] text-[17px] text-text">
                            {t(`caseDetail.reason.${analysis.reason}`, { count: analysis.votesMissing, total: CONSENSUS_MIN_VOTES })}{" "}
                            {open && analysis.state !== "ruled" && <b className="text-ink">{t("caseDetail.threshold", { count: CONSENSUS_MIN_VOTES })}</b>}
                        </p>
                        {dismissal && <p className="m-0 text-[15px] text-text">{t("caseDetail.dismissedBecause", { reason: dismissal.reason })}</p>}
                        {analysis.reopened[0] && analysis.state !== "ruled" && analysis.state !== "dismissed" && (
                            <p className="m-0 max-w-[760px] border-l-4 border-action pl-3 text-[15px] text-text">
                                {t("caseDetail.reopenedBy", {
                                    who: personName(analysis.reopened[0].reviewerEmail, jurors),
                                    letter: letters.get(analysis.reopened[0].testimonyId) ?? "?",
                                })}
                                {analysis.reopened[0].comment?.trim() && <span className="text-text-muted"> “{analysis.reopened[0].comment.trim()}”</span>}{" "}
                                {t("caseDetail.reopenedVotes", { count: analysis.supersededVotes.length })}
                            </p>
                        )}
                    </div>
                    <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-[15px]">
                        <dt className="font-semibold text-ink">{t("caseDetail.proposedBy")}</dt>
                        <dd className="m-0 text-text">
                            {personName(record.authorEmail, jurors)} · {formatDate(record.createdAt, language)}
                        </dd>
                        <dt className="font-semibold text-ink">{t("caseDetail.category")}</dt>
                        <dd className="m-0 text-text">{record.category}</dd>
                        <dt className="font-semibold text-ink">{t("caseDetail.votesSoFar")}</dt>
                        <dd className="m-0 text-text">{t("caseDetail.votesOf", { count: leading?.votesFor ?? 0, total: CONSENSUS_MIN_VOTES })}</dd>
                        <dt className="font-semibold text-ink">{t("caseDetail.you")}</dt>
                        <dd className="m-0 text-text">
                            {!viewer.canAct
                                ? t("caseDetail.youReadOnly")
                                : myVoteLetter?.letter
                                  ? t(myVoteLetter.value === "for" ? "caseDetail.youVotedFor" : "caseDetail.youVotedAgainst", { letter: myVoteLetter.letter })
                                  : t("caseDetail.youHaventVoted")}
                        </dd>
                    </dl>
                </div>
            </div>

            <p role="status" className="m-0 text-[15px] font-semibold text-ruled empty:hidden">
                {notice}
            </p>
            {failure !== undefined && <Objection compact message={t("errors.save")} technicalDetails={String(failure)} />}
            {!viewer.canAct && <p className="m-0 border-l-4 border-review pl-3 text-[15px] text-text">{t("docket.readOnly")}</p>}

            <section aria-labelledby="answers-title" className="flex flex-col gap-4">
                <h2 id="answers-title" className="m-0 font-serif text-[30px] font-bold text-ink">
                    {answersTitle}
                </h2>
                {analysis.tallies.length === 0 ? (
                    <EmptyState message={t("caseDetail.noAnswers")} />
                ) : (
                    <div className="grid gap-5 min-[900px]:grid-cols-2">
                        {analysis.tallies.map((tally) => {
                            const testimony = testimonyById.get(tally.testimony.id)!;
                            const letter = letters.get(testimony.id)!;
                            const isOwn = viewer.me?.userId === testimony.authorUserId;
                            return (
                                <TestimonyCard
                                    key={testimony.id}
                                    letter={letter}
                                    testimony={testimony}
                                    tally={tally}
                                    author={personName(testimony.authorEmail, jurors)}
                                    team={personTeam(testimony.authorEmail, jurors)}
                                    minVotes={CONSENSUS_MIN_VOTES}
                                    isRuling={analysis.rulingTestimonyId === testimony.id}
                                    myVote={myVotes.get(testimony.id)}
                                    canVote={viewer.canAct && open && tally.valid && !isOwn}
                                    isOwn={isOwn && viewer.canAct}
                                    busy={busy}
                                    onVote={vote(testimony.id, letter)}
                                />
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
                <div className="flex flex-col gap-5">
                    {compared.length === 2 && (
                        <section aria-labelledby="diff-title" className="flex flex-col gap-2">
                            <h2 id="diff-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                                {t("diff.title")}
                            </h2>
                            <p className="m-0 text-[15px] text-text">{t("diff.help")}</p>
                            <DiffTable
                                left={{ letter: letters.get(compared[0].testimony.id)!, testimony: testimonyById.get(compared[0].testimony.id)! }}
                                right={{ letter: letters.get(compared[1].testimony.id)!, testimony: testimonyById.get(compared[1].testimony.id)! }}
                            />
                        </section>
                    )}
                    {open && (viewer.canAct || viewer.isAdmin) && panel === "none" && (
                        <div className="flex flex-wrap items-center gap-5">
                            {viewer.canAct && (
                                <Button variant="primary" compact onClick={() => setPanel("answer")}>
                                    {addAnswerLabel}
                                </Button>
                            )}
                            {(isAuthor || viewer.isAdmin) && (
                                <Button variant="danger-text" onClick={() => setPanel("dismiss")}>
                                    {t("dismiss.open")}
                                </Button>
                            )}
                        </div>
                    )}
                    {panel === "answer" && (
                        <AnswerForm
                            client={client}
                            caseId={record.id}
                            title={addAnswerLabel}
                            onCancel={() => setPanel("none")}
                            onSaved={() => {
                                setPanel("none");
                                setNotice(t("caseDetail.answerSaved"));
                                records.reload();
                            }}
                        />
                    )}
                    {panel === "dismiss" && (
                        <form onSubmit={(event) => void dismiss(event)} noValidate className="flex flex-col gap-3 border border-ink bg-paper-raised p-5">
                            <h3 className="m-0 font-serif text-[22px] font-bold text-ink">{t("dismiss.title")}</h3>
                            <p className="m-0 text-[15px] text-text">{t("dismiss.help")}</p>
                            <TextAreaField
                                label={t("dismiss.reason")}
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                maxLength={1000}
                                rows={2}
                                required
                                error={reasonError}
                            />
                            <div className="flex flex-wrap gap-3">
                                <Button type="submit" variant="secondary" disabled={busy}>
                                    {t("dismiss.submit")}
                                </Button>
                                <Button variant="quiet" disabled={busy} onClick={() => setPanel("none")}>
                                    {t("common.cancel")}
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
                <CourtRecord events={caseEvents(item.records)} letters={letters} jurors={jurors} now={now} />
            </div>
        </article>
    );
}
