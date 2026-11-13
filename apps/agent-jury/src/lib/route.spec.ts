import { describe, expect, it } from "vitest";
import { formatRoute, parseRoute } from "./route";

const AGENT = "00000000-0000-4000-8000-000000000021";

describe("route", () => {
    it("reads and writes every page", () => {
        for (const hash of [`#home?agent=${AGENT}`, "#home", `#cases?agent=${AGENT}&filter=vote&q=active+customers`, `#case/${AGENT}`, `#hearings?agent=${AGENT}`, "#hearings", `#hearing/${AGENT}`, "#clerk", "#intro", "#guide", "#source", "#feedback", "#feedback?from=cases"]) {
            expect(formatRoute(parseRoute(hash))).toBe(hash);
        }
    });

    it("keeps only a plain screen name as the page the feedback came from", () => {
        expect(parseRoute("#feedback?from=hearings")).toEqual({ page: "feedback", from: "hearings" });
        expect(parseRoute("#feedback?from=<script>")).toEqual({ page: "feedback", from: undefined });
        expect(parseRoute(`#feedback?from=${AGENT}`)).toEqual({ page: "feedback", from: undefined });
    });

    it("falls back to Home and drops values that aren't ids or known filters", () => {
        expect(parseRoute("#nowhere")).toEqual({ page: "home", agentId: undefined });
        expect(parseRoute("#cases?agent=<script>&filter=weird")).toEqual({ page: "cases", agentId: undefined, filter: "all", query: "" });
        expect(parseRoute("#case/not an id")).toEqual({ page: "home", agentId: undefined });
    });
});
