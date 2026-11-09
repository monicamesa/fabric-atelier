import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
    | { status: "loading"; data?: T; error?: undefined }
    | { status: "success"; data: T; error?: undefined }
    | { status: "error"; data?: T; error: unknown };

/**
 * Runs `load` on mount and whenever `reload` is called. Keeps the last data while reloading,
 * and ignores results from superseded runs.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> & { reload: () => void } {
    const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
    const [version, setVersion] = useState(0);
    const loadRef = useRef(load);
    useEffect(() => {
        loadRef.current = load;
    });

    useEffect(() => {
        let active = true;
        Promise.resolve()
            .then(() => loadRef.current())
            .then(
                (data) => active && setState({ status: "success", data }),
                (error: unknown) => active && setState((previous) => ({ status: "error", data: previous.data, error })),
            );
        return () => {
            active = false;
        };
    }, [version]);

    const reload = useCallback(() => {
        setState((previous) => ({ status: "loading", data: previous.data }));
        setVersion((value) => value + 1);
    }, []);
    return { ...state, reload };
}
