import type { CaseAnalysis, CaseRecords } from "@/rules/case-validity";
import { caseEvents } from "@/rules/case-validity";

/** What the Home ticker says about a case. "Dismissed" cases and cases by non-jurors (R7) never appear. */
export type TickerStatus = "new" | "disputed" | "ruled";

export interface TickerEvent {
    caseId: string;
    caseText: string;
    status: TickerStatus;
    /** When the case reached this status. */
    at: string;
    /** For "ruled": jurors in favour and jurors who voted on the ruling answer, to say "all 3" or "2 of 3". */
    agreed?: number;
    total?: number;
}

export const TICKER_MAX_ITEMS = 8;
/** Below this many events the band is not worth showing. */
export const TICKER_MIN_ITEMS = 2;

interface TickerCase {
    record: { id: string; text: string; createdAt?: Date | string };
    analysis: CaseAnalysis;
    records: CaseRecords;
}

/**
 * The latest news of the docket, from records already loaded at startup (no queries of its own): one line per
 * case, saying where it stands now and since when, newest first.
 */
export function buildTicker(cases: readonly TickerCase[]): TickerEvent[] {
    const events: TickerEvent[] = [];
    for (const { record, analysis, records } of cases) {
        if (!analysis.verified || analysis.state === "dismissed") continue;
        const status: TickerStatus = analysis.state === "under_review" ? "new" : analysis.state;
        const timeline = caseEvents(records);
        const lastState = [...timeline].reverse().find((event) => event.kind === "state");
        const proposed = timeline.find((event) => event.kind === "proposed");
        const at = (lastState && lastState.state === analysis.state ? lastState.at : proposed?.at) ?? new Date(record.createdAt ?? 0).toISOString();
        const event: TickerEvent = { caseId: record.id, caseText: record.text, status, at };
        if (status === "ruled") {
            const ruling = analysis.tallies.find((tally) => tally.testimony.id === analysis.rulingTestimonyId);
            if (ruling) {
                event.agreed = ruling.votesFor;
                event.total = ruling.votesFor + ruling.votesAgainst;
            }
        }
        events.push(event);
    }
    return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, TICKER_MAX_ITEMS);
}
