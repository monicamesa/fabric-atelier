import { describe, expect, it } from "vitest";
import type { Route } from "@/lib/route";
import { routeAfterLaunch, docketStage, sessionStage } from "./launch-stages";

const CASE_ROUTE: Route = { page: "case", caseId: "00000000-0000-4000-8000-000000000031" };
const HOME: Route = { page: "home", agentId: undefined };

describe("routing after the launch", () => {
    it("sends a first-time user to the Intro", () => {
        expect(routeAfterLaunch(false, HOME)).toEqual({ route: { page: "intro" }, afterIntro: HOME });
    });

    it("sends a returning user to Home", () => {
        expect(routeAfterLaunch(true, HOME)).toEqual({ route: HOME, afterIntro: undefined });
    });

    it("keeps the deep link for a returning user", () => {
        expect(routeAfterLaunch(true, CASE_ROUTE).route).toEqual(CASE_ROUTE);
    });

    it("shows the Intro first to a new user with a deep link, then continues to the link", () => {
        expect(routeAfterLaunch(false, CASE_ROUTE)).toEqual({ route: { page: "intro" }, afterIntro: CASE_ROUTE });
    });

    it("keeps a link to the Intro itself (replay), which then leads Home", () => {
        expect(routeAfterLaunch(true, { page: "intro" })).toEqual({ route: { page: "intro" }, afterIntro: { page: "home" } });
        expect(routeAfterLaunch(false, { page: "intro" })).toEqual({ route: { page: "intro" }, afterIntro: { page: "home" } });
    });
});

describe("launch stages from real loads", () => {
    const loading = { status: "loading" } as const;
    const loaded = { status: "success", data: [] } as const;

    it("session: waits for the juror list, then needs a juror record", () => {
        expect(sessionStage({ jury: loading, hasJurorRecord: false })).toEqual({ status: "pending" });
        expect(sessionStage({ jury: loaded, hasJurorRecord: true })).toEqual({ status: "ok" });
        expect(sessionStage({ jury: loaded, hasJurorRecord: false })).toMatchObject({ status: "error", error: { kind: "notJuror" } });
    });

    it("session: a connection or load failure is an error, but a reload keeps the data", () => {
        expect(sessionStage({ connectError: new Error("Missing env"), jury: loading, hasJurorRecord: false })).toMatchObject({ status: "error" });
        expect(sessionStage({ jury: { status: "error", error: new Error("401 Unauthorized") }, hasJurorRecord: false })).toMatchObject({
            status: "error",
            error: { kind: "session" },
        });
        expect(sessionStage({ jury: { status: "loading", data: [] }, hasJurorRecord: true })).toEqual({ status: "ok" });
    });

    it("docket: needs the agents, the intro lookup and the docket when the first screen uses it", () => {
        expect(docketStage({ agents: loading, introChecked: true })).toEqual({ status: "pending" });
        expect(docketStage({ agents: loaded, introChecked: false })).toEqual({ status: "pending" });
        expect(docketStage({ agents: loaded, introChecked: true, docket: loading })).toEqual({ status: "pending" });
        expect(docketStage({ agents: loaded, introChecked: true, docket: loaded })).toEqual({ status: "ok" });
        expect(docketStage({ agents: loaded, introChecked: true })).toEqual({ status: "ok" });
    });

    it("docket: failures become errors with a kind", () => {
        expect(docketStage({ agents: { status: "error", error: Object.assign(new Error("x"), { status: 503 }) }, introChecked: true })).toMatchObject({
            status: "error",
            error: { kind: "busy" },
        });
        expect(
            docketStage({ agents: loaded, introChecked: true, docket: { status: "error", error: new Error("Too many requests") } }),
        ).toMatchObject({ status: "error", error: { kind: "busy" } });
    });
});
