/** Launch screen logic (design guide, section 6b): pure, so every state is testable without timers. */

export type LaunchErrorKind = "session" | "signIn" | "notJuror" | "busy" | "unknown";

export interface LaunchError {
    kind: LaunchErrorKind;
    /** Shown only inside "Technical details". */
    details: string;
}

export type LaunchStage = { status: "pending" } | { status: "ok" } | { status: "error"; error: LaunchError };

export type LaunchPhase = "session" | "docket" | "ready" | "done" | "error";

export interface LaunchView {
    phase: LaunchPhase;
    /** After ~8 s without finishing: show "Taking longer than usual" and Try again. */
    slow: boolean;
    error?: LaunchError;
}

/** Elapsed time is measured from `startedAt`; a new `startedAt` (the user clicked Try again) starts over. */
export interface LaunchClock {
    startedAt: number;
    elapsedMs: number;
    completedAtMs?: number;
}

export const MIN_VISIBLE_MS = 800;
export const SLOW_AFTER_MS = 8_000;
export const ALL_RISE_HOLD_MS = 600;

const SESSION_ERROR = /\b401\b|unauthori[sz]ed|expired|not authenticated|invalid token/i;
const BUSY_ERROR = /\b429\b|\b5\d\d\b|too many requests|throttl|time(d)?[ -]?out|temporarily unavailable|capacity|busy|bad gateway/i;

/** Sorts any failure into the cases the launch screen explains, plus a generic one. */
export function classifyLaunchError(error: unknown): LaunchError {
    const record = typeof error === "object" && error !== null ? (error as { name?: unknown; message?: unknown; status?: unknown }) : {};
    const message = typeof record.message === "string" ? record.message : String(error);
    const name = typeof record.name === "string" ? record.name : "Error";
    const status = typeof record.status === "number" ? record.status : undefined;
    const details = `${name}${status ? ` ${status}` : ""}: ${message}`.slice(0, 500);

    if (name === "AuthError" || status === 401 || SESSION_ERROR.test(message)) return { kind: "session", details };
    if (status === 429 || (status !== undefined && status >= 500) || BUSY_ERROR.test(message)) return { kind: "busy", details };
    return { kind: "unknown", details };
}

export function notJurorError(): LaunchError {
    return { kind: "notJuror", details: "Signed in, but there is no active juror record for this account." };
}

function failure(session: LaunchStage, docket: LaunchStage): LaunchError | undefined {
    if (session.status === "error") return session.error;
    if (docket.status === "error") return docket.error;
    return undefined;
}

export function allStagesOk(session: LaunchStage, docket: LaunchStage): boolean {
    return session.status === "ok" && docket.status === "ok";
}

/**
 * Which step to show. Steps follow the real work: Session (auth and the juror record), then Docket (the
 * initial data load), then All rise once both finished, no sooner than MIN_VISIBLE_MS after the start.
 */
export function deriveLaunch(session: LaunchStage, docket: LaunchStage, clock: LaunchClock): LaunchView {
    const error = failure(session, docket);
    if (error) return { phase: "error", slow: false, error };

    const finished = allStagesOk(session, docket);
    if (finished && clock.completedAtMs !== undefined) {
        const readyAt = Math.max(clock.completedAtMs, MIN_VISIBLE_MS);
        if (clock.elapsedMs >= readyAt + ALL_RISE_HOLD_MS) return { phase: "done", slow: false };
        if (clock.elapsedMs >= readyAt) return { phase: "ready", slow: false };
        return { phase: "docket", slow: false };
    }

    return {
        phase: session.status === "ok" ? "docket" : "session",
        slow: !finished && clock.elapsedMs >= SLOW_AFTER_MS,
    };
}

/** Milliseconds until the view can change by time alone, or undefined when only new inputs can change it. */
export function nextCheckpointMs(session: LaunchStage, docket: LaunchStage, clock: LaunchClock): number | undefined {
    if (failure(session, docket)) return undefined;
    if (allStagesOk(session, docket)) {
        if (clock.completedAtMs === undefined) return undefined;
        const readyAt = Math.max(clock.completedAtMs, MIN_VISIBLE_MS);
        const next = clock.elapsedMs < readyAt ? readyAt : readyAt + ALL_RISE_HOLD_MS;
        return next > clock.elapsedMs ? next - clock.elapsedMs : undefined;
    }
    return clock.elapsedMs < SLOW_AFTER_MS ? SLOW_AFTER_MS - clock.elapsedMs : undefined;
}

export interface ClockObservation {
    startedAt: number;
    elapsedMs: number;
    allOk: boolean;
}

export function initialClock(startedAt: number): LaunchClock {
    return { startedAt, elapsedMs: 0 };
}

/** Records the elapsed time and when both stages first finished (forgotten if one goes back to work). */
export function observeClock(state: LaunchClock, observation: ClockObservation): LaunchClock {
    const fresh = observation.startedAt !== state.startedAt;
    const completedAtMs = !observation.allOk
        ? undefined
        : fresh || state.completedAtMs === undefined
          ? observation.elapsedMs
          : state.completedAtMs;
    return { startedAt: observation.startedAt, elapsedMs: observation.elapsedMs, completedAtMs };
}
