import { useEffect, useReducer } from "react";
import { useLaunchClock } from "./launch-clock.context";
import {
    allStagesOk,
    deriveLaunch,
    initialClock,
    nextCheckpointMs,
    observeClock,
    type LaunchClock,
    type LaunchStage,
    type LaunchView,
} from "./launch-machine";

type ClockAction = { startedAt: number; elapsedMs: number; allOk: boolean };

function reducer(state: LaunchClock, action: ClockAction): LaunchClock {
    return observeClock(state, action);
}

/**
 * The launch view for the current stages. Time only moves the view at its thresholds (a single timer
 * to the next one, never a polling loop); stage changes move it immediately.
 */
export function useLaunch(session: LaunchStage, docket: LaunchStage): LaunchView {
    const { startedAt } = useLaunchClock();
    const [clock, observe] = useReducer(reducer, startedAt, initialClock);
    const allOk = allStagesOk(session, docket);

    useEffect(() => {
        observe({ startedAt, elapsedMs: performance.now() - startedAt, allOk });
    }, [startedAt, allOk, session.status, docket.status]);

    const delay = nextCheckpointMs(session, docket, clock);
    useEffect(() => {
        if (delay === undefined) return undefined;
        const timer = window.setTimeout(() => observe({ startedAt, elapsedMs: performance.now() - startedAt, allOk }), delay);
        return () => window.clearTimeout(timer);
    }, [delay, startedAt, allOk, clock]);

    return deriveLaunch(session, docket, clock.startedAt === startedAt ? clock : initialClock(startedAt));
}
