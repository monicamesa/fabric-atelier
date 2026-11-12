import type { Route } from "@/lib/route";
import { classifyLaunchError, notJurorError, type LaunchStage } from "./launch-machine";

interface LoadState<T> {
    status: "loading" | "success" | "error";
    data?: T;
    error?: unknown;
}

const PENDING: LaunchStage = { status: "pending" };
const OK: LaunchStage = { status: "ok" };

function failed(error: unknown): LaunchStage {
    return { status: "error", error: classifyLaunchError(error) };
}

/** Step 1: the client could be built, the juror list loaded, and this account is on it. */
export function sessionStage({
    connectError,
    jury,
    hasJurorRecord,
}: {
    connectError?: unknown;
    jury: LoadState<unknown>;
    hasJurorRecord: boolean;
}): LaunchStage {
    if (connectError !== undefined) return failed(connectError);
    if (jury.status === "error" && !jury.data) return failed(jury.error);
    if (!jury.data) return PENDING;
    return hasJurorRecord ? OK : { status: "error", error: notJurorError() };
}

/**
 * Step 2: the parallel initial load. `docket` is omitted when the first screen does not use it
 * (a deep link to a case, hearing or the clerk's office, or no agents on trial yet).
 */
export function docketStage({
    agents,
    docket,
    introChecked,
}: {
    agents: LoadState<unknown>;
    docket?: LoadState<unknown>;
    introChecked: boolean;
}): LaunchStage {
    if (agents.status === "error" && !agents.data) return failed(agents.error);
    if (!agents.data || !introChecked) return PENDING;
    if (docket) {
        if (docket.status === "error" && !docket.data) return failed(docket.error);
        if (!docket.data) return PENDING;
    }
    return OK;
}

export interface LaunchDestination {
    route: Route;
    /** Where "Enter the courtroom" goes after a first-time Intro. */
    afterIntro?: Route;
}

/** First time for this user: the Intro, then the page they asked for. Otherwise the page they asked for (Home by default). */
export function routeAfterLaunch(introSeen: boolean, route: Route): LaunchDestination {
    if (introSeen || route.page === "intro") {
        return { route, afterIntro: route.page === "intro" ? { page: "home" } : undefined };
    }
    return { route: { page: "intro" }, afterIntro: route };
}
