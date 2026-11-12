// Judge trust (I3b): how often the jury agrees with the AI judge, per agent and per critic-prompt version.
// Pure, shared by the UI and the Functions, like the case rules. A changed critic prompt is a different judge (D5),
// so each version has its own numbers: the current one prominently, earlier ones as history.
import { judgeAgrees, validReviews, type JurorRecord, type ReviewRecord, type ReviewRecords, type VerdictLink } from "./case-validity.js";

export const DEFAULT_CRITIC_PROMPT_VERSION = "default";

/**
 * The critic prompt the hearings use. `text` stays undefined while the SDK's default prompt is in use. To change the
 * judge, set `text` and give it a new `version` in the same commit: hearings store the version, and judge trust
 * keeps a separate record for each one.
 */
export const CRITIC_PROMPT: { version: string; text?: string } = { version: DEFAULT_CRITIC_PROMPT_VERSION };

/** D4: the big percentage appears from this many decided verdicts; "n of m" is always shown. */
export const JUDGE_TRUST_MIN_DECIDED = 5;

export interface TrustHearing {
    id: string;
    agent_id: string;
    criticPromptVersion?: string | null;
    createdAt: Date | string;
}

export type TrustVerdict = Pick<VerdictLink, "id" | "hearing_id" | "case_id" | "judgeVerdict"> & { createdAt?: Date | string };

export type TrustStatus = "agree" | "disagree" | "pending" | "excluded" | "unreviewed";

export interface TrustCounts {
    agreed: number;
    disagreed: number;
    /** Agreed + disagreed. */
    decided: number;
    /** The jury is split evenly: not counted either way. */
    pending: number;
    /** Only "expected answer is wrong" reviews: the judge compared well with a bad answer. */
    excluded: number;
    unreviewed: number;
    percent: number | null;
    showPercent: boolean;
}

export interface VersionTrust extends TrustCounts {
    version: string;
    current: boolean;
}

export interface Overruled {
    verdictId: string;
    caseId: string;
    /** When the jury's majority review was written. */
    at: string;
}

export interface JudgeTrust {
    current: VersionTrust;
    history: VersionTrust[];
    /** Per hearing: "the jury agrees with the judge in n of m". */
    byHearing: Record<string, TrustCounts>;
    /** Verdicts where the jury's majority disagrees with the judge (appeals won), for the ticker. */
    overruled: Overruled[];
}

export function criticPromptVersionOf(hearing: { criticPromptVersion?: string | null }): string {
    return hearing.criticPromptVersion?.trim() || DEFAULT_CRITIC_PROMPT_VERSION;
}

const time = (value: Date | string | undefined) => (value === undefined ? 0 : new Date(value).getTime());

function counts(statuses: readonly TrustStatus[]): TrustCounts {
    const n = (status: TrustStatus) => statuses.filter((item) => item === status).length;
    const agreed = n("agree");
    const disagreed = n("disagree");
    const decided = agreed + disagreed;
    return {
        agreed,
        disagreed,
        decided,
        pending: n("pending"),
        excluded: n("excluded"),
        unreviewed: n("unreviewed"),
        percent: decided > 0 ? Math.round((agreed / decided) * 100) : null,
        showPercent: decided >= JUDGE_TRUST_MIN_DECIDED,
    };
}

interface Judged {
    status: TrustStatus;
    at?: string;
}

/** One verdict: seeded and "expected answer is wrong" reviews don't count; the majority of the rest decides, a tie is pending. */
function judge(verdict: TrustVerdict, reviews: readonly ReviewRecord[]): Judged {
    const real = reviews.filter((review) => review.source !== "seed");
    if (real.length === 0) return { status: "unreviewed" };
    const counting = real.filter((review) => review.reason !== "expected_answer_wrong");
    if (counting.length === 0) return { status: "excluded" };
    const agree = counting.filter((review) => judgeAgrees(verdict.judgeVerdict, review.humanVerdict)).length;
    const disagree = counting.length - agree;
    const at = new Date(Math.max(...counting.map((review) => time(review.createdAt)))).toISOString();
    if (agree > disagree) return { status: "agree", at };
    if (disagree > agree) return { status: "disagree", at };
    return { status: "pending" };
}

export interface JudgeTrustInput {
    agentId: string;
    hearings: readonly TrustHearing[];
    verdicts: readonly TrustVerdict[];
    reviewRecords: ReviewRecords;
    jurors: readonly JurorRecord[];
    now: Date;
    currentVersion?: string;
}

export function judgeTrust({ agentId, hearings, verdicts, reviewRecords, jurors, now, currentVersion = CRITIC_PROMPT.version }: JudgeTrustInput): JudgeTrust {
    const mine = new Map(hearings.filter((hearing) => hearing.agent_id === agentId).map((hearing) => [hearing.id, hearing]));
    const valid = validReviews({ ...reviewRecords, verdicts }, jurors, now);
    const byVerdict = new Map<string, ReviewRecord[]>();
    for (const { review } of valid) byVerdict.set(review.verdict_id, [...(byVerdict.get(review.verdict_id) ?? []), review]);

    const perVersion = new Map<string, { statuses: TrustStatus[]; latest: number }>();
    const perHearing = new Map<string, TrustStatus[]>();
    const overruled: Overruled[] = [];
    for (const verdict of verdicts) {
        const hearing = mine.get(verdict.hearing_id);
        if (!hearing) continue;
        const judged = judge(verdict, byVerdict.get(verdict.id) ?? []);
        const version = criticPromptVersionOf(hearing);
        const entry = perVersion.get(version) ?? { statuses: [], latest: 0 };
        entry.statuses.push(judged.status);
        entry.latest = Math.max(entry.latest, time(hearing.createdAt));
        perVersion.set(version, entry);
        perHearing.set(hearing.id, [...(perHearing.get(hearing.id) ?? []), judged.status]);
        if (judged.status === "disagree" && judged.at) overruled.push({ verdictId: verdict.id, caseId: verdict.case_id, at: judged.at });
    }

    const summary = (version: string): VersionTrust => ({ version, current: version === currentVersion, ...counts(perVersion.get(version)?.statuses ?? []) });
    const history = [...perVersion.entries()]
        .filter(([version]) => version !== currentVersion)
        .sort((a, b) => b[1].latest - a[1].latest)
        .map(([version]) => summary(version));
    return {
        current: summary(currentVersion),
        history,
        byHearing: Object.fromEntries([...perHearing.entries()].map(([id, statuses]) => [id, counts(statuses)])),
        overruled: overruled.sort((a, b) => b.at.localeCompare(a.at)),
    };
}
