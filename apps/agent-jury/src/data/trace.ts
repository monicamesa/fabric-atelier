import type { AppRayfinClient } from "@/lib/rayfin-client";

type TraceClient = Pick<AppRayfinClient, "data">;

export type TraceLanguage = "dax" | "sql" | "kql";

export interface TraceStep {
    k: "source" | "query";
    /** The tool the agent used (sources only). */
    tool?: string;
    /** The plain-words request that was sent to the tool (sources only). */
    request?: string;
    lang?: TraceLanguage;
    code?: string;
}

export interface VerdictTraceRow {
    id: string;
    steps: string;
    truncated: boolean;
    sdkVersion: string;
}

const LANGUAGES: readonly string[] = ["dax", "sql", "kql"];

/** Reads the stored steps defensively: anything that is not a well-formed step is dropped, never thrown. */
export function parseTraceSteps(text: string | null | undefined): TraceStep[] {
    if (!text) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return [];
    }
    if (!Array.isArray(parsed)) return [];
    const steps: TraceStep[] = [];
    for (const item of parsed as Record<string, unknown>[]) {
        if (!item || typeof item !== "object") continue;
        const str = (value: unknown) => (typeof value === "string" ? value : undefined);
        if (item.k === "source" && typeof item.tool === "string") {
            steps.push({ k: "source", tool: item.tool, request: str(item.request) });
        } else if (item.k === "query" && typeof item.code === "string" && typeof item.lang === "string" && LANGUAGES.includes(item.lang)) {
            steps.push({ k: "query", lang: item.lang as TraceLanguage, code: item.code });
        }
    }
    return steps;
}

/** Which kind of tool a source step used, to say it in plain words; anything unknown keeps its own name. */
export function toolKind(tool: string | undefined): "semanticModel" | "toQuery" | "other" {
    const name = (tool ?? "").toLowerCase();
    if (name.includes("semantic_model")) return "semanticModel";
    if (name.includes("nl2code")) return "toQuery";
    return "other";
}

/** The distinct query languages used, in the order they appear, for the one-line summary. */
export function queryLanguages(steps: readonly TraceStep[]): TraceLanguage[] {
    return [...new Set(steps.flatMap((step) => (step.k === "query" && step.lang ? [step.lang] : [])))];
}

/** The trace of one verdict, or undefined when none was recorded (older verdicts, seeded rows, or a notebook that could not read the steps). */
export async function loadVerdictTrace(client: TraceClient, verdictId: string): Promise<VerdictTraceRow | undefined> {
    const rows = (await client.data.VerdictTrace.select(["id", "steps", "truncated", "sdkVersion"])
        .where({ verdict_id: { eq: verdictId } })
        .first(1)
        .execute()) as VerdictTraceRow[] | undefined;
    return rows?.[0];
}
