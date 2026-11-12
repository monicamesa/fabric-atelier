import type { DocketCase } from "@/data/docket";
import { estimateSeconds, HEARING_COOLDOWN_SECONDS, HEARING_MAX_CASES } from "../../../rayfin/functions/src/hearing-rules";
import { approverStillNeeded, nextStep, unreviewedVerdicts, type TurnContext } from "./next-step";

export const MAX_TURN_LINES = 4;

export type TurnLineKey = "approverVote" | "vote" | "disputed" | "review" | "hearing";

export interface TurnLine {
    key: TurnLineKey;
    count: number;
    /** The case to open (for votes), or undefined when the action goes elsewhere. */
    caseId?: string;
    /** The hearing whose verdicts are waiting for this person's review. */
    hearingId?: string;
}

export interface YourTurn {
    lines: TurnLine[];
    /** True when nothing is pending for this person (and they can act). */
    upToDate: boolean;
    /** Open cases that wait for other jurors, not for this person: context for the "up to date" line. */
    othersWaiting: number;
    /** Admins only: a hearing started recently, so the next one may have to wait. */
    hearingMayBeBusy: boolean;
}

/** A hearing may still be in session, or in the rest that follows: its estimated length plus the 10-minute rest. */
export function hearingMayBeBusy(latestHearingAt: Date | string | undefined, now: Date): boolean {
    if (!latestHearingAt) return false;
    const started = new Date(latestHearingAt).getTime();
    if (Number.isNaN(started)) return false;
    return now.getTime() - started < (estimateSeconds(HEARING_MAX_CASES) + HEARING_COOLDOWN_SECONDS) * 1000;
}

/**
 * "Your turn": what needs this person now, most urgent first, at most four lines. Built only from the cases already
 * loaded for the selected agent. Reviews that could not be read hide the lines that depend on them.
 */
export function yourTurn(
    cases: readonly DocketCase[],
    ctx: TurnContext & { isAdmin: boolean },
    options: { reviewsAvailable: boolean; latestHearingAt?: Date | string; now: Date },
): YourTurn {
    if (!ctx.canAct) return { lines: [], upToDate: false, othersWaiting: 0, hearingMayBeBusy: false };

    const lines: TurnLine[] = [];
    const add = (key: TurnLineKey, matches: DocketCase[], extra?: (first: DocketCase) => Partial<TurnLine>) => {
        if (matches.length > 0) lines.push({ key, count: matches.length, caseId: matches[0].record.id, ...extra?.(matches[0]) });
    };

    const votable = cases.filter((item) => item.needsMyVote);
    const approverTurn = ctx.role === "approver" ? votable.filter((item) => item.analysis.state === "under_review" && approverStillNeeded(item)) : [];
    const approverIds = new Set(approverTurn.map((item) => item.record.id));
    add("approverVote", approverTurn);
    add("vote", votable.filter((item) => item.analysis.state === "under_review" && !approverIds.has(item.record.id)));
    add("disputed", votable.filter((item) => item.analysis.state === "disputed"));

    if (options.reviewsAvailable) {
        const toReview = cases.filter((item) => nextStep(item, ctx).key === "reviewVerdict");
        const verdicts = toReview.flatMap((item) => unreviewedVerdicts(item, ctx.me));
        if (verdicts.length > 0) lines.push({ key: "review", count: verdicts.length, caseId: toReview[0].record.id, hearingId: verdicts[0].hearing_id });
        if (ctx.isAdmin) {
            const ready = cases.filter((item) => nextStep(item, ctx).key === "readyForHearing" && item.analysis.verified);
            add("hearing", ready);
        }
    }

    const shown = lines.slice(0, MAX_TURN_LINES);
    return {
        lines: shown,
        upToDate: lines.length === 0,
        othersWaiting: cases.filter((item) => (item.analysis.state === "under_review" || item.analysis.state === "disputed") && !item.needsMyVote).length,
        hearingMayBeBusy: ctx.isAdmin && shown.some((line) => line.key === "hearing") && hearingMayBeBusy(options.latestHearingAt, options.now),
    };
}

export type Stage = "propose" | "vote" | "ruled" | "hearing" | "review";

export interface StageCount {
    stage: Stage;
    count: number;
    /** What is stuck at this stage, shown when it is the bottleneck. */
    waiting: number;
    /** For Review: how many verdicts there are in all. */
    total?: number;
}

export interface Progress {
    stages: StageCount[];
    /** The stage where the most work is waiting (the earliest on a tie); undefined when nothing waits. */
    bottleneck?: Stage;
}

/** Propose · Vote · Ruled · Hearing · Review for one agent, with what waits at each step. */
export function gameProgress(cases: readonly DocketCase[], reviewsAvailable: boolean): Progress {
    const open = cases.filter((item) => item.analysis.state === "under_review" || item.analysis.state === "disputed");
    const ruled = cases.filter((item) => item.analysis.state === "ruled");
    const verdictsOf = (item: DocketCase) => item.records.reviewRecords?.verdicts ?? [];
    const judged = ruled.filter((item) => verdictsOf(item).length > 0);
    const ruledWaiting = ruled.filter((item) => verdictsOf(item).length === 0);
    const allVerdicts = cases.flatMap((item) => verdictsOf(item).map((verdict) => ({ item, verdict })));
    const unreviewed = allVerdicts.filter(({ item, verdict }) => !(item.records.reviewRecords?.reviews ?? []).some((review) => review.verdict_id === verdict.id));

    const stages: StageCount[] = [
        { stage: "propose", count: cases.length, waiting: 0 },
        { stage: "vote", count: open.length, waiting: open.length },
        { stage: "ruled", count: ruled.length, waiting: 0 },
    ];
    if (reviewsAvailable) {
        stages.push(
            { stage: "hearing", count: judged.length, waiting: ruledWaiting.length },
            { stage: "review", count: allVerdicts.length - unreviewed.length, waiting: unreviewed.length, total: allVerdicts.length },
        );
    }
    const worst = stages.reduce<StageCount | undefined>((best, current) => (current.waiting > (best?.waiting ?? 0) ? current : best), undefined);
    return { stages, bottleneck: worst?.stage };
}
