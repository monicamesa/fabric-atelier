import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { ReviewRecord } from "@/rules/case-validity";
import type { HearingEventKind, HearingStage } from "../../rayfin/functions/src/hearing-rules";
import { readAllPages } from "./pagination";
import { listReviews } from "./reviews.service";

type DataClient = Pick<AppRayfinClient, "data">;

export interface HearingRow {
    id: string;
    agent_id: string;
    stage: HearingStage;
    launchedByEmail: string;
    caseCount: number;
    criticPromptVersion?: string | null;
    createdAt: Date | string;
}

export interface HearingCaseRow {
    id: string;
    hearing_id: string;
    case_id: string;
    testimony_id: string;
    position: number;
    question: string;
    expectedAnswer: string;
}

export interface HearingEventRow {
    id: string;
    hearing_id: string;
    kind: HearingEventKind;
    detail?: string | null;
    createdAt: Date | string;
}

export interface VerdictRow {
    id: string;
    hearing_id: string;
    case_id: string;
    agentAnswer: string;
    judgeVerdict: "correct" | "incorrect" | "unclear";
    judgeMessage: string;
    dataAgentVersion?: string | null;
    dataAgentEtag?: string | null;
    dataAgentLastUpdated?: string | null;
    createdAt: Date | string;
}

export interface HearingRecords {
    hearings: HearingRow[];
    cases: HearingCaseRow[];
    events: HearingEventRow[];
    verdicts: VerdictRow[];
    /** The jurors' reviews of the verdicts (appeals are reviews that differ from the judge). */
    reviews: ReviewRecord[];
}

const HEARING_FIELDS = ["id", "agent_id", "stage", "launchedByEmail", "caseCount", "criticPromptVersion", "createdAt"] as const;
const CASE_FIELDS = ["id", "hearing_id", "case_id", "testimony_id", "position", "question", "expectedAnswer"] as const;
const EVENT_FIELDS = ["id", "hearing_id", "kind", "detail", "createdAt"] as const;
const VERDICT_FIELDS = [
    "id",
    "hearing_id",
    "case_id",
    "agentAnswer",
    "judgeVerdict",
    "judgeMessage",
    "dataAgentVersion",
    "dataAgentEtag",
    "dataAgentLastUpdated",
    "createdAt",
] as const;
// Whole-table reads, in one parallel round: hearings stay few and each request has a fixed cost on the backend.
const PAGE = 1000;

/** Everything about hearings in one parallel round; the screens filter it in the client. */
export async function loadHearingRecords(client: DataClient): Promise<HearingRecords> {
    const [hearings, cases, events, verdicts, reviews] = await Promise.all([
        readAllPages((after) => {
            const query = client.data.Hearing.select([...HEARING_FIELDS]).orderBy({ createdAt: "desc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        readAllPages((after) => {
            const query = client.data.HearingCase.select([...CASE_FIELDS]).orderBy({ position: "asc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        readAllPages((after) => {
            const query = client.data.HearingEvent.select([...EVENT_FIELDS]).orderBy({ createdAt: "asc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        readAllPages((after) => {
            const query = client.data.Verdict.select([...VERDICT_FIELDS]).orderBy({ createdAt: "asc" }).first(PAGE);
            return (after ? query.after(after) : query).executePaginated();
        }),
        listReviews(client),
    ]);
    return {
        hearings: hearings as HearingRow[],
        cases: cases as HearingCaseRow[],
        events: events as HearingEventRow[],
        verdicts: verdicts as VerdictRow[],
        reviews,
    };
}
