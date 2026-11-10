import { useCallback, useEffect, useRef, useState } from "react";

/** D3: re-read every 60 s, at most 20 times, only with the tab visible and the hearing in session. */
export const REFRESH_EVERY_MS = 60_000;
export const REFRESH_MAX = 20;

/**
 * Re-reads `reload` while `active`. Also reads once when the tab becomes visible again after being hidden.
 * Stops after REFRESH_MAX automatic reads; `refresh` (the button) always works and re-arms the count.
 */
export function useAutoRefresh(active: boolean, reload: () => void) {
    const [reads, setReads] = useState(0);
    const [stopped, setStopped] = useState(false);
    const count = useRef(0);
    const reloadRef = useRef(reload);
    useEffect(() => {
        reloadRef.current = reload;
    });

    useEffect(() => {
        if (!active) return;
        const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
        const read = () => {
            if (count.current >= REFRESH_MAX) {
                setStopped(true);
                return;
            }
            count.current += 1;
            setReads(count.current);
            reloadRef.current();
        };
        const timer = window.setInterval(() => {
            if (visible()) read();
        }, REFRESH_EVERY_MS);
        const onVisibility = () => {
            if (visible()) read();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [active]);

    const refresh = useCallback(() => {
        count.current = 0;
        setReads(0);
        setStopped(false);
        reloadRef.current();
    }, []);

    return { refresh, reads, stopped };
}
