import { useCallback, useMemo, useState, type ReactNode } from "react";
import { LaunchClockContext, type LaunchClockValue } from "./launch-clock.context";

/** One clock for the whole launch, so the sign-in step and the data step share the same 800 ms and 8 s. */
export function LaunchClockProvider({ children }: { children: ReactNode }) {
    const [startedAt, setStartedAt] = useState(() => performance.now());
    const restart = useCallback(() => setStartedAt(performance.now()), []);
    const value = useMemo<LaunchClockValue>(() => ({ startedAt, restart }), [startedAt, restart]);
    return <LaunchClockContext.Provider value={value}>{children}</LaunchClockContext.Provider>;
}
