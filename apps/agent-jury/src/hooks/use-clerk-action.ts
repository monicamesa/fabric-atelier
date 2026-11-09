import { useCallback, useState } from "react";
import type { ClerkCommand } from "../../rayfin/functions/src/clerk-actions";
import { runClerkAction, type ClerkPayload } from "@/data/clerk.service";
import { describeClerkError, type ClerkErrorView } from "@/data/clerk-errors";
import type { AppRayfinClient } from "@/lib/rayfin-client";

type ClerkClient = Pick<AppRayfinClient, "data" | "auth" | "functions">;

/** Runs clerk actions one at a time and keeps the plain-language error of the last failure. */
export function useClerkAction(client: ClerkClient | undefined, onDone: () => void) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<ClerkErrorView | null>(null);

    const run = useCallback(
        async <A extends ClerkCommand["action"]>(action: A, payload: ClerkPayload<A>): Promise<boolean> => {
            setPending(true);
            setError(null);
            try {
                if (!client) throw new Error("The app is not connected.");
                await runClerkAction(client, action, payload);
                onDone();
                return true;
            } catch (caught) {
                setError(describeClerkError(caught));
                return false;
            } finally {
                setPending(false);
            }
        },
        [client, onDone],
    );

    return { run, pending, error, clearError: () => setError(null) };
}
