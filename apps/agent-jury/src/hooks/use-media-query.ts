import { useCallback, useSyncExternalStore } from "react";

const hasMatchMedia = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** Whether a CSS media query matches; `fallback` where matchMedia is missing (tests, old browsers). */
export function useMediaQuery(query: string, fallback = false): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            if (!hasMatchMedia()) return () => {};
            const list = window.matchMedia(query);
            list.addEventListener("change", onChange);
            return () => list.removeEventListener("change", onChange);
        },
        [query],
    );
    return useSyncExternalStore(
        subscribe,
        () => (hasMatchMedia() ? window.matchMedia(query).matches : fallback),
        () => fallback,
    );
}
