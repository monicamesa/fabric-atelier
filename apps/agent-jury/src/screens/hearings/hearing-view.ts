import { estimateSeconds, hearingState, type HearingState } from "../../../rayfin/functions/src/hearing-rules";
import type { HearingCaseRow, HearingEventRow, HearingRecords, HearingRow, VerdictRow } from "@/data/hearings.service";

export interface HearingView {
    hearing: HearingRow;
    state: HearingState;
    cases: HearingCaseRow[];
    verdicts: VerdictRow[];
    events: HearingEventRow[];
    /** Verdicts given so far over the questions asked. */
    done: number;
    total: number;
    started: boolean;
    failedDetail?: string;
    /** Seconds the plan quoted for the whole hearing, minus the time already spent (never below zero). */
    remainingSeconds: number;
    overtime: boolean;
}

export interface Scoreboard {
    correct: number;
    incorrect: number;
    unclear: number;
}

export function scoreboard(verdicts: readonly VerdictRow[]): Scoreboard {
    return {
        correct: verdicts.filter((verdict) => verdict.judgeVerdict === "correct").length,
        incorrect: verdicts.filter((verdict) => verdict.judgeVerdict === "incorrect").length,
        unclear: verdicts.filter((verdict) => verdict.judgeVerdict === "unclear").length,
    };
}

/** One hearing with everything the screens need, derived from the records (R6): nothing here is stored. */
export function viewHearing(hearing: HearingRow, records: HearingRecords, now: Date): HearingView {
    const events = records.events.filter((event) => event.hearing_id === hearing.id);
    const cases = records.cases.filter((row) => row.hearing_id === hearing.id).sort((a, b) => a.position - b.position);
    const verdicts = records.verdicts.filter((verdict) => verdict.hearing_id === hearing.id);
    const state = hearingState(hearing, events, now);
    const spent = (now.getTime() - new Date(hearing.createdAt).getTime()) / 1000;
    const expected = estimateSeconds(hearing.caseCount);
    const failed = [...events].reverse().find((event) => event.kind === "failed");
    return {
        hearing,
        state,
        cases,
        verdicts,
        events,
        done: Math.min(verdicts.length, hearing.caseCount),
        total: hearing.caseCount,
        started: events.some((event) => event.kind === "started"),
        failedDetail: state === "failed" ? (failed?.detail ?? undefined) : undefined,
        remainingSeconds: Math.max(0, Math.round(expected - spent)),
        overtime: state === "in_progress" && spent > expected,
    };
}

/** Newest first. */
export function viewHearings(records: HearingRecords, now: Date, agentId?: string): HearingView[] {
    return records.hearings
        .filter((hearing) => !agentId || hearing.agent_id.toLowerCase() === agentId.toLowerCase())
        .map((hearing) => viewHearing(hearing, records, now))
        .sort((a, b) => new Date(b.hearing.createdAt).getTime() - new Date(a.hearing.createdAt).getTime());
}

/** Whether any hearing (of any agent) is still in session: the capacity runs one at a time. */
export function anyInSession(records: HearingRecords, now: Date): boolean {
    return viewHearings(records, now).some((view) => view.state === "in_progress");
}

/** The question tied to a verdict, from the snapshot taken when the hearing started. */
export function questionFor(view: HearingView, verdict: VerdictRow): HearingCaseRow | undefined {
    return view.cases.find((row) => row.case_id.toLowerCase() === verdict.case_id.toLowerCase());
}
