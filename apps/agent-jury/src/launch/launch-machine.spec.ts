import { describe, expect, it } from "vitest";
import {
    ALL_RISE_HOLD_MS,
    MIN_VISIBLE_MS,
    SLOW_AFTER_MS,
    classifyLaunchError,
    deriveLaunch,
    initialClock,
    nextCheckpointMs,
    notJurorError,
    observeClock,
    type LaunchClock,
    type LaunchStage,
} from "./launch-machine";

const PENDING: LaunchStage = { status: "pending" };
const OK: LaunchStage = { status: "ok" };
const clock = (elapsedMs: number, completedAtMs?: number): LaunchClock => ({ startedAt: 0, elapsedMs, completedAtMs });

describe("launch steps follow the real work", () => {
    it("starts at Session while the session is pending", () => {
        expect(deriveLaunch(PENDING, PENDING, clock(100))).toEqual({ phase: "session", slow: false });
    });

    it("moves to Docket once the session is resolved", () => {
        expect(deriveLaunch(OK, PENDING, clock(300))).toEqual({ phase: "docket", slow: false });
    });

    it("never shows All rise before the data is in, however long it takes", () => {
        expect(deriveLaunch(OK, PENDING, clock(MIN_VISIBLE_MS + 5_000)).phase).toBe("docket");
    });

    it("stays on Docket until the minimum time, so a fast load does not flash", () => {
        expect(deriveLaunch(OK, OK, clock(200, 200)).phase).toBe("docket");
        expect(deriveLaunch(OK, OK, clock(MIN_VISIBLE_MS - 1, 200)).phase).toBe("docket");
    });

    it("strikes the gavel at the minimum time and holds All rise for about 600 ms", () => {
        expect(deriveLaunch(OK, OK, clock(MIN_VISIBLE_MS, 200)).phase).toBe("ready");
        expect(deriveLaunch(OK, OK, clock(MIN_VISIBLE_MS + ALL_RISE_HOLD_MS - 1, 200)).phase).toBe("ready");
        expect(deriveLaunch(OK, OK, clock(MIN_VISIBLE_MS + ALL_RISE_HOLD_MS, 200)).phase).toBe("done");
    });

    it("holds All rise from the moment the data arrives when that is after the minimum", () => {
        expect(deriveLaunch(OK, OK, clock(3_000, 3_000)).phase).toBe("ready");
        expect(deriveLaunch(OK, OK, clock(3_000 + ALL_RISE_HOLD_MS - 1, 3_000)).phase).toBe("ready");
        expect(deriveLaunch(OK, OK, clock(3_000 + ALL_RISE_HOLD_MS, 3_000)).phase).toBe("done");
    });

    it("does not call it ready before the clock has seen both stages finish", () => {
        expect(deriveLaunch(OK, OK, clock(9_000)).phase).toBe("docket");
    });
});

describe("slow launch", () => {
    it("shows the slow message after about 8 seconds, in either step", () => {
        expect(deriveLaunch(PENDING, PENDING, clock(SLOW_AFTER_MS - 1)).slow).toBe(false);
        expect(deriveLaunch(PENDING, PENDING, clock(SLOW_AFTER_MS)).slow).toBe(true);
        expect(deriveLaunch(OK, PENDING, clock(SLOW_AFTER_MS)).slow).toBe(true);
    });

    it("drops the slow message once everything finished", () => {
        expect(deriveLaunch(OK, OK, clock(SLOW_AFTER_MS + 100, SLOW_AFTER_MS + 100)).slow).toBe(false);
    });

    it("schedules one check at the slow threshold and none after it (no polling)", () => {
        expect(nextCheckpointMs(PENDING, PENDING, clock(1_000))).toBe(SLOW_AFTER_MS - 1_000);
        expect(nextCheckpointMs(PENDING, PENDING, clock(SLOW_AFTER_MS))).toBeUndefined();
    });
});

describe("launch errors", () => {
    it.each([
        ["an expired session", new Error("Request failed with 401 Unauthorized"), "session"],
        ["an auth error", Object.assign(new Error("Token refresh failed"), { name: "AuthError" }), "session"],
        ["throttling", Object.assign(new Error("Too many requests"), { status: 429 }), "busy"],
        ["a server error", Object.assign(new Error("Bad gateway"), { status: 502 }), "busy"],
        ["a timeout", new Error("The request timed out"), "busy"],
        ["anything else", new Error("Something odd"), "unknown"],
    ] as const)("sorts %s as %s", (_label, error, kind) => {
        expect(classifyLaunchError(error).kind).toBe(kind);
    });

    it("keeps the technical details short and readable", () => {
        const details = classifyLaunchError(Object.assign(new Error("x".repeat(2_000)), { status: 503 })).details;
        expect(details.startsWith("Error 503: ")).toBe(true);
        expect(details.length).toBeLessThanOrEqual(500);
    });

    it("shows the session error first, then the data error", () => {
        const session = { status: "error", error: classifyLaunchError(new Error("401")) } as const;
        const docket = { status: "error", error: classifyLaunchError(new Error("Bad gateway")) } as const;
        expect(deriveLaunch(session, docket, clock(50)).error?.kind).toBe("session");
        expect(deriveLaunch(OK, docket, clock(50))).toMatchObject({ phase: "error", slow: false, error: { kind: "busy" } });
    });

    it("shows not-a-juror as an error with no timers running", () => {
        const session: LaunchStage = { status: "error", error: notJurorError() };
        expect(deriveLaunch(session, PENDING, clock(100)).error?.kind).toBe("notJuror");
        expect(nextCheckpointMs(session, PENDING, clock(100))).toBeUndefined();
    });
});

describe("launch clock", () => {
    it("remembers when both stages first finished", () => {
        let state = initialClock(1_000);
        state = observeClock(state, { startedAt: 1_000, elapsedMs: 200, allOk: false });
        expect(state.completedAtMs).toBeUndefined();
        state = observeClock(state, { startedAt: 1_000, elapsedMs: 450, allOk: true });
        state = observeClock(state, { startedAt: 1_000, elapsedMs: 900, allOk: true });
        expect(state).toEqual({ startedAt: 1_000, elapsedMs: 900, completedAtMs: 450 });
    });

    it("forgets completion when a stage goes back to work", () => {
        let state = observeClock(initialClock(0), { startedAt: 0, elapsedMs: 450, allOk: true });
        state = observeClock(state, { startedAt: 0, elapsedMs: 500, allOk: false });
        expect(state.completedAtMs).toBeUndefined();
    });

    it("starts over when the user clicks Try again (new start time)", () => {
        let state = observeClock(initialClock(0), { startedAt: 0, elapsedMs: 9_000, allOk: false });
        state = observeClock(state, { startedAt: 9_100, elapsedMs: 10, allOk: false });
        expect(deriveLaunch(PENDING, PENDING, state).slow).toBe(false);
    });

    it("schedules the strike and the end of All rise", () => {
        expect(nextCheckpointMs(OK, OK, clock(300, 300))).toBe(MIN_VISIBLE_MS - 300);
        expect(nextCheckpointMs(OK, OK, clock(MIN_VISIBLE_MS, 300))).toBe(ALL_RISE_HOLD_MS);
        expect(nextCheckpointMs(OK, OK, clock(MIN_VISIBLE_MS + ALL_RISE_HOLD_MS, 300))).toBeUndefined();
    });
});
