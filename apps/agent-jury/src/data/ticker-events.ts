import type { CaseAnalysis, CaseRecords } from "@/rules/case-validity";
import { caseEvents } from "@/rules/case-validity";
import type { TrustHearing, TrustVerdict } from "@/rules/judge-trust";

/**
 * What the Home ticker says. Case lines (new, disputed, ruled) come from the case rules; judge lines say what the AI
 * judge decided in the latest hearing of each case, and when the jury overruled it. Dismissed cases and cases by
 * non-jurors (R7) never appear.
 */
export type TickerStatus = "new" | "disputed" | "ruled" | "correct" | "incorrect" | "unclear" | "overruled";

export interface TickerEvent {
    caseId: string;
    caseText: string;
    /** The language the question was written in; missing on older cases. */
    caseLanguage?: string | null;
    status: TickerStatus;
    /** When the case reached this status, or when the judge ruled. */
    at: string;
    /** For "ruled": jurors in favour and jurors who voted on the ruling answer, to say "all 3" or "2 of 3". */
    agreed?: number;
    total?: number;
}

export const TICKER_MAX_ITEMS = 8;
/** Below this many events the band is not worth showing. */
export const TICKER_MIN_ITEMS = 2;

interface TickerCase {
    record: { id: string; text: string; language?: string | null; createdAt?: Date | string };
    analysis: CaseAnalysis;
    records: CaseRecords;
}

/** Verdicts and hearings of the agent, and the verdicts where the jury's majority disagreed with the judge. Absent when they could not be read. */
export interface TickerJudgeData {
    hearings: readonly TrustHearing[];
    verdicts: readonly TrustVerdict[];
    overruled: readonly { verdictId: string; caseId: string; at: string }[];
}

const time = (value: Date | string | undefined) => (value === undefined ? 0 : new Date(value).getTime());

/** The latest verdict of each case: the one from the most recent hearing (then the most recent verdict). */
function latestVerdicts(data: TickerJudgeData, caseIds: ReadonlySet<string>): TrustVerdict[] {
    const hearingTime = new Map(data.hearings.map((hearing) => [hearing.id, time(hearing.createdAt)]));
    const latest = new Map<string, TrustVerdict>();
    for (const verdict of data.verdicts) {
        if (!caseIds.has(verdict.case_id) || !hearingTime.has(verdict.hearing_id)) continue;
        const current = latest.get(verdict.case_id);
        const rank = (item: TrustVerdict) => [hearingTime.get(item.hearing_id) ?? 0, time(item.createdAt)];
        const [h1, v1] = rank(verdict);
        const [h0, v0] = current ? rank(current) : [-1, -1];
        if (h1 > h0 || (h1 === h0 && v1 >= v0)) latest.set(verdict.case_id, verdict);
    }
    return [...latest.values()];
}

/**
 * The latest news of the docket, from records already loaded at startup (no queries of its own): where each case
 * stands now and since when, what the AI judge said, and the appeals the jury won. Newest first, at most 8.
 */
export function buildTicker(cases: readonly TickerCase[], judge?: TickerJudgeData): TickerEvent[] {
    const events: TickerEvent[] = [];
    const shown = new Map<string, TickerCase>();
    for (const item of cases) {
        const { record, analysis, records } = item;
        if (!analysis.verified || analysis.state === "dismissed") continue;
        shown.set(record.id, item);
        const status: TickerStatus = analysis.state === "under_review" ? "new" : analysis.state;
        const timeline = caseEvents(records);
        const lastState = [...timeline].reverse().find((event) => event.kind === "state");
        const proposed = timeline.find((event) => event.kind === "proposed");
        const at = (lastState && lastState.state === analysis.state ? lastState.at : proposed?.at) ?? new Date(record.createdAt ?? 0).toISOString();
        const event: TickerEvent = { caseId: record.id, caseText: record.text, caseLanguage: record.language, status, at };
        if (status === "ruled") {
            const ruling = analysis.tallies.find((tally) => tally.testimony.id === analysis.rulingTestimonyId);
            if (ruling) {
                event.agreed = ruling.votesFor;
                event.total = ruling.votesFor + ruling.votesAgainst;
            }
        }
        events.push(event);
    }
    if (judge) {
        for (const verdict of latestVerdicts(judge, new Set(shown.keys()))) {
            const item = shown.get(verdict.case_id)!;
            events.push({ caseId: verdict.case_id, caseText: item.record.text, caseLanguage: item.record.language, status: verdict.judgeVerdict, at: new Date(time(verdict.createdAt)).toISOString() });
        }
        const latestIds = new Set(latestVerdicts(judge, new Set(shown.keys())).map((verdict) => verdict.id));
        for (const overruled of judge.overruled) {
            const item = shown.get(overruled.caseId);
            if (item && latestIds.has(overruled.verdictId)) events.push({ caseId: overruled.caseId, caseText: item.record.text, caseLanguage: item.record.language, status: "overruled", at: overruled.at });
        }
    }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, TICKER_MAX_ITEMS);
}
