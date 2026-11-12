import { createContext, useContext } from "react";

export interface LaunchClockValue {
    /** `performance.now()` when the launch screen first appeared, or when the user last clicked Try again. */
    startedAt: number;
    /** Starts the clock over. Called only from a click on Try again: nothing retries by itself. */
    restart: () => void;
}

export const LaunchClockContext = createContext<LaunchClockValue>({ startedAt: 0, restart: () => {} });

export function useLaunchClock(): LaunchClockValue {
    return useContext(LaunchClockContext);
}
