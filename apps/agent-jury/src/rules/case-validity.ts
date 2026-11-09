// Single source of the case rules R1–R8 (AGENTS.md rule 18). Pure: no network and no system clock
// (callers pass `now`). The frontend uses it for display; I3's notebook applies the same logic.
import { CONSENSUS_MIN_VOTES, FUTURE_TOLERANCE_MS } from "./consensus";

export type JurorRole = "expert" | "approver" | "admin";
export type CaseState = "under_review" | "ruled" | "disputed" | "dismissed";
export type VoteValue = "for" | "against";

export interface JurorRecord {
    email: string;
    role: JurorRole;
    active: boolean;
}

export interface CaseRecord {
    id: string;
    authorUserId: string;
    authorEmail: string;
    createdAt?: Date | string;
}

export interface TestimonyRecord {
    id: string;
    case_id: string;
    authorUserId: string;
    authorEmail: string;
    createdAt: Date | string;
}

export interface VoteRecord {
    id: string;
    testimony_id: string;
    value: VoteValue;
    comment?: string | null;
    voterUserId: string;
    voterEmail: string;
    createdAt: Date | string;
}

export interface CaseDismissalRecord {
    id?: string;
    case_id: string;
    dismissedByUserId: string;
    dismissedByEmail: string;
    createdAt?: Date | string;
}

export interface CaseRecords {
    caseRecord: CaseRecord;
    testimonies: readonly TestimonyRecord[];
    votes: readonly VoteRecord[];
    dismissals: readonly CaseDismissalRecord[];
    jurors: readonly JurorRecord[];
    now: Date;
    minVotes?: number;
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function findActiveJuror(jurors: readonly JurorRecord[], email: string): JurorRecord | undefined {
    const target = normalizeEmail(email);
    return jurors.find((juror) => juror.active && normalizeEmail(juror.email) === target);
}

function time(value: Date | string | undefined): number {
    return value === undefined ? 0 : new Date(value).getTime();
}

/** D13: a record dated more than the tolerance after `now` does not count. */
export function isFutureDated(record: { createdAt?: Date | string }, now: Date): boolean {
    return time(record.createdAt) > now.getTime() + FUTURE_TOLERANCE_MS;
}

function byTimeThenId(a: { createdAt?: Date | string; id?: string }, b: { createdAt?: Date | string; id?: string }): number {
    return time(a.createdAt) - time(b.createdAt) || (a.id ?? "").localeCompare(b.id ?? "");
}

/** R7: only cases authored by an active juror count. */
export function isVerifiedCase(caseRecord: CaseRecord, jurors: readonly JurorRecord[]): boolean {
    return findActiveJuror(jurors, caseRecord.authorEmail) !== undefined;
}

/** R7: only testimonies by active jurors count, and never future-dated ones. */
export function isValidTestimony(testimony: TestimonyRecord, jurors: readonly JurorRecord[], now: Date): boolean {
    return findActiveJuror(jurors, testimony.authorEmail) !== undefined && !isFutureDated(testimony, now);
}

/** R8: a dismissal counts when it comes from the case author or from an active admin. */
export function isValidDismissal(
    dismissal: CaseDismissalRecord,
    caseRecord: CaseRecord,
    jurors: readonly JurorRecord[],
    now?: Date,
): boolean {
    if (dismissal.case_id !== caseRecord.id || (now && isFutureDated(dismissal, now))) {
        return false;
    }
    if (dismissal.dismissedByUserId === caseRecord.authorUserId) {
        return true;
    }
    return findActiveJuror(jurors, dismissal.dismissedByEmail)?.role === "admin";
}

/** R1: per voter and testimony only the latest vote stands (by createdAt, then id). Future-dated votes are dropped. */
export function currentVotes(votes: readonly VoteRecord[], now: Date): VoteRecord[] {
    const latest = new Map<string, VoteRecord>();
    for (const vote of [...votes].filter((item) => !isFutureDated(item, now)).sort(byTimeThenId)) {
        latest.set(`${vote.voterUserId}|${vote.testimony_id}`, vote);
    }
    return [...latest.values()];
}

/** R2, R4 (D4), R7: whether a standing vote counts for a testimony. */
export function countsForTestimony(vote: VoteRecord, testimony: TestimonyRecord, jurors: readonly JurorRecord[]): boolean {
    if (vote.testimony_id !== testimony.id) return false;
    if (!findActiveJuror(jurors, vote.voterEmail)) return false;
    const ownAnswer = vote.voterUserId === testimony.authorUserId || normalizeEmail(vote.voterEmail) === normalizeEmail(testimony.authorEmail);
    if (ownAnswer) return false;
    return vote.value === "for" || Boolean(vote.comment?.trim());
}

/** D11: only approvers carry the approver weight; an admin votes as an expert. */
function isApprover(email: string, jurors: readonly JurorRecord[]): boolean {
    return findActiveJuror(jurors, email)?.role === "approver";
}

export interface TestimonyTally {
    testimony: TestimonyRecord;
    valid: boolean;
    votesFor: number;
    votesAgainst: number;
    approverFor: number;
    approverAgainst: number;
}

export type StateReason =
    | "dismissed"
    | "noAnswers"
    | "competingAnswers"
    | "approverSplit"
    | "ruled"
    | "needsVotes"
    | "needsApprover"
    | "approverAgainst";

export interface CaseAnalysis {
    state: CaseState;
    reason: StateReason;
    verified: boolean;
    tallies: TestimonyTally[];
    rulingTestimonyId?: string;
    /** Valid votes still missing for the leading answer to reach the threshold. */
    votesMissing: number;
    standingVotes: VoteRecord[];
}

/** R1–R8: derives the state of a case from its records. Priority: dismissed > disputed > ruled > under_review. */
export function analyzeCase({ caseRecord, testimonies, votes, dismissals, jurors, now, minVotes = CONSENSUS_MIN_VOTES }: CaseRecords): CaseAnalysis {
    const verified = isVerifiedCase(caseRecord, jurors);
    const own = testimonies.filter((testimony) => testimony.case_id === caseRecord.id);
    const ownIds = new Set(own.map((testimony) => testimony.id));
    const standingVotes = currentVotes(votes.filter((vote) => ownIds.has(vote.testimony_id)), now);
    const tallies: TestimonyTally[] = own.sort(byTimeThenId).map((testimony) => {
        const valid = isValidTestimony(testimony, jurors, now);
        const counted = valid ? standingVotes.filter((vote) => countsForTestimony(vote, testimony, jurors)) : [];
        const votesFor = counted.filter((vote) => vote.value === "for");
        const votesAgainst = counted.filter((vote) => vote.value === "against");
        return {
            testimony,
            valid,
            votesFor: votesFor.length,
            votesAgainst: votesAgainst.length,
            approverFor: votesFor.filter((vote) => isApprover(vote.voterEmail, jurors)).length,
            approverAgainst: votesAgainst.filter((vote) => isApprover(vote.voterEmail, jurors)).length,
        };
    });
    const leading = [...tallies].filter((tally) => tally.valid).sort((a, b) => b.votesFor - a.votesFor)[0];
    const votesMissing = Math.max(0, minVotes - (leading?.votesFor ?? 0));
    const base = { verified, tallies, standingVotes, votesMissing };

    if (dismissals.some((dismissal) => isValidDismissal(dismissal, caseRecord, jurors, now))) {
        return { ...base, state: "dismissed", reason: "dismissed" };
    }
    const supported = tallies.filter((tally) => tally.valid && tally.votesFor > 0);
    if (supported.length >= 2) {
        return { ...base, state: "disputed", reason: "competingAnswers" };
    }
    if (tallies.some((tally) => tally.approverFor > 0 && tally.approverAgainst > 0)) {
        return { ...base, state: "disputed", reason: "approverSplit" };
    }
    const ruling = tallies.find(
        (tally) => tally.valid && tally.votesFor >= minVotes && tally.approverFor >= 1 && tally.approverAgainst === 0,
    );
    if (ruling) {
        return { ...base, state: "ruled", reason: "ruled", rulingTestimonyId: ruling.testimony.id, votesMissing: 0 };
    }
    if (!tallies.some((tally) => tally.valid)) {
        return { ...base, state: "under_review", reason: "noAnswers" };
    }
    if (leading && leading.approverAgainst > 0) {
        return { ...base, state: "under_review", reason: "approverAgainst" };
    }
    if (votesMissing > 0) {
        return { ...base, state: "under_review", reason: "needsVotes" };
    }
    return { ...base, state: "under_review", reason: "needsApprover" };
}

export function getCaseState(records: CaseRecords): CaseState {
    return analyzeCase(records).state;
}

export interface Me {
    userId: string;
    email: string;
}

/** D5: verified, open case with a valid answer that isn't mine and no standing vote of mine. Admins included (D11). */
export function needsMyVote(records: CaseRecords, analysis: CaseAnalysis, me: Me): boolean {
    if (!findActiveJuror(records.jurors, me.email)) return false;
    if (!analysis.verified || (analysis.state !== "under_review" && analysis.state !== "disputed")) return false;
    const someoneElses = analysis.tallies.some((tally) => tally.valid && tally.testimony.authorUserId !== me.userId);
    const voted = analysis.standingVotes.some((vote) => vote.voterUserId === me.userId);
    return someoneElses && !voted;
}

export type CaseEvent =
    | { kind: "proposed"; at: string; actorEmail: string }
    | { kind: "answer"; at: string; actorEmail: string; testimonyId: string; counts: boolean; futureDated: boolean }
    | { kind: "vote"; at: string; actorEmail: string; testimonyId: string; value: VoteValue; comment?: string | null; futureDated: boolean }
    | { kind: "dismissal"; at: string; actorEmail: string; counts: boolean; futureDated: boolean }
    | { kind: "state"; at: string; state: CaseState };

const iso = (value: Date | string | undefined) => new Date(time(value)).toISOString();

/** R6: the court record. "Ruled" and "disputed" are replayed from the records in order, never stored. */
export function caseEvents(records: CaseRecords): CaseEvent[] {
    const { caseRecord, testimonies, votes, dismissals, jurors, now } = records;
    const own = testimonies.filter((testimony) => testimony.case_id === caseRecord.id);
    const ownIds = new Set(own.map((testimony) => testimony.id));
    const ownVotes = votes.filter((vote) => ownIds.has(vote.testimony_id));
    const ownDismissals = dismissals
        .filter((dismissal) => dismissal.case_id === caseRecord.id)
        .map((dismissal, index) => ({ dismissal, key: dismissal.id ?? `dismissal-${index}` }));

    type Step = { at: Date | string; id: string; event: CaseEvent; future: boolean };
    const steps: Step[] = [
        ...own.map((t) => ({
            at: t.createdAt,
            id: t.id,
            future: isFutureDated(t, now),
            event: { kind: "answer", at: iso(t.createdAt), actorEmail: t.authorEmail, testimonyId: t.id, counts: isValidTestimony(t, jurors, now), futureDated: isFutureDated(t, now) } as CaseEvent,
        })),
        ...ownVotes.map((v) => ({
            at: v.createdAt,
            id: v.id,
            future: isFutureDated(v, now),
            event: { kind: "vote", at: iso(v.createdAt), actorEmail: v.voterEmail, testimonyId: v.testimony_id, value: v.value, comment: v.comment, futureDated: isFutureDated(v, now) } as CaseEvent,
        })),
        ...ownDismissals.map(({ dismissal: d, key }) => ({
            at: d.createdAt ?? new Date(0),
            id: key,
            future: isFutureDated(d, now),
            event: { kind: "dismissal", at: iso(d.createdAt), actorEmail: d.dismissedByEmail, counts: isValidDismissal(d, caseRecord, jurors, now), futureDated: isFutureDated(d, now) } as CaseEvent,
        })),
    ].sort((a, b) => byTimeThenId({ createdAt: a.at, id: a.id }, { createdAt: b.at, id: b.id }));

    const events: CaseEvent[] = [{ kind: "proposed", at: iso(caseRecord.createdAt), actorEmail: caseRecord.authorEmail }];
    let previous: CaseState = "under_review";
    const seen = { testimonies: [] as TestimonyRecord[], votes: [] as VoteRecord[], dismissals: [] as CaseDismissalRecord[] };
    for (const step of steps) {
        events.push(step.event);
        if (step.future) continue;
        if (step.event.kind === "answer") seen.testimonies.push(own.find((t) => t.id === step.id)!);
        if (step.event.kind === "vote") seen.votes.push(ownVotes.find((v) => v.id === step.id)!);
        if (step.event.kind === "dismissal") seen.dismissals.push(ownDismissals.find(({ key }) => key === step.id)!.dismissal);
        const state = getCaseState({ ...records, testimonies: seen.testimonies, votes: seen.votes, dismissals: seen.dismissals });
        if (state !== previous) {
            events.push({ kind: "state", at: step.event.at, state });
            previous = state;
        }
    }
    return events;
}
