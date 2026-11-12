import { useCallback, useContext, useEffect, useRef } from "react";
import { AuthContext } from "@/hooks/auth.context";
import { useLaunchClock } from "./launch-clock.context";
import type { LaunchStage } from "./launch-machine";
import { LaunchScreen } from "./launch-screen";
import { useLaunch } from "./use-launch";

interface LaunchGateProps {
    session: LaunchStage;
    docket: LaunchStage;
    /** Reload what failed or is slow. Runs only after a click on Try again, never by itself. */
    onRetry?: () => void;
    /** Called once, after "All rise" has been shown. */
    onReady?: () => void;
}

/** The launch screen driven by the real stages of the start-up. */
export function LaunchGate({ session, docket, onRetry, onReady }: LaunchGateProps) {
    const view = useLaunch(session, docket);
    const { restart } = useLaunchClock();
    const auth = useContext(AuthContext);

    const retry = useCallback(() => {
        restart();
        onRetry?.();
    }, [restart, onRetry]);

    useEffect(() => {
        if (view.phase === "done") onReady?.();
    }, [view.phase, onReady]);

    // Signing in is the user's own click; once it succeeds, load again from the start.
    const signInClicked = useRef(false);
    const signingIn = auth?.isSigningIn ?? false;
    const signedIn = Boolean(auth?.isAuthenticated);
    const signIn = auth?.signIn;
    const handleSignIn = useCallback(() => {
        signInClicked.current = true;
        signIn?.();
    }, [signIn]);
    useEffect(() => {
        if (signInClicked.current && !signingIn && signedIn) {
            signInClicked.current = false;
            retry();
        }
    }, [signingIn, signedIn, retry]);

    return (
        <LaunchScreen
            view={view}
            onRetry={retry}
            onSignIn={signIn ? handleSignIn : undefined}
            signingIn={signingIn}
            signInName={auth?.session?.user?.email ?? undefined}
        />
    );
}
