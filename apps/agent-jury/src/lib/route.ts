import { useCallback, useEffect, useState } from "react";

export type CasesFilter = "all" | "vote" | "mine";

export type Route =
    | { page: "home"; agentId?: string }
    | { page: "cases"; agentId?: string; filter: CasesFilter; query: string }
    | { page: "case"; caseId: string }
    | { page: "hearings"; agentId?: string }
    | { page: "hearing"; hearingId: string }
    | { page: "clerk" }
    | { page: "guide" }
    | { page: "source" }
    | { page: "feedback"; from?: string }
    | { page: "intro" };

const ID = /^[0-9a-f-]{1,36}$/i;

/** Reads `#home?agent=…`, `#cases?agent=…&filter=vote&q=…`, `#case/<id>`, `#hearings?agent=…`, `#hearing/<id>`, `#feedback?from=…` and `#clerk`. Anything else is Home. */
export function parseRoute(hash: string): Route {
    const [path, search = ""] = hash.replace(/^#/, "").split("?");
    const params = new URLSearchParams(search);
    const agent = params.get("agent");
    const agentId = agent && ID.test(agent) ? agent : undefined;
    if (path === "clerk") return { page: "clerk" };
    if (path === "intro") return { page: "intro" };
    if (path === "guide") return { page: "guide" };
    if (path === "source") return { page: "source" };
    if (path === "feedback") {
        const from = params.get("from");
        return { page: "feedback", from: from && /^[a-z]{1,20}$/.test(from) ? from : undefined };
    }
    if (path.startsWith("hearing/")) {
        const hearingId = path.slice("hearing/".length);
        if (ID.test(hearingId)) return { page: "hearing", hearingId };
    }
    if (path === "hearings") return { page: "hearings", agentId };
    if (path.startsWith("case/")) {
        const caseId = path.slice("case/".length);
        if (ID.test(caseId)) return { page: "case", caseId };
    }
    if (path === "cases") {
        const filter = params.get("filter");
        return { page: "cases", agentId, filter: filter === "vote" || filter === "mine" ? filter : "all", query: params.get("q") ?? "" };
    }
    return { page: "home", agentId };
}

export function formatRoute(route: Route): string {
    switch (route.page) {
        case "clerk":
            return "#clerk";
        case "intro":
            return "#intro";
        case "guide":
            return "#guide";
        case "source":
            return "#source";
        case "feedback":
            return route.from ? `#feedback?from=${route.from}` : "#feedback";
        case "case":
            return `#case/${route.caseId}`;
        case "hearing":
            return `#hearing/${route.hearingId}`;
        case "hearings":
            return route.agentId ? `#hearings?agent=${route.agentId}` : "#hearings";
        case "cases": {
            const params = new URLSearchParams();
            if (route.agentId) params.set("agent", route.agentId);
            if (route.filter !== "all") params.set("filter", route.filter);
            if (route.query) params.set("q", route.query);
            const search = params.toString();
            return `#cases${search ? `?${search}` : ""}`;
        }
        default:
            return route.agentId ? `#home?agent=${route.agentId}` : "#home";
    }
}

/** Current route from the URL hash; `navigate` adds a history entry, `replace` doesn't (typing in the search box). */
export function useRoute() {
    const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
    useEffect(() => {
        const onChange = () => setRoute(parseRoute(window.location.hash));
        window.addEventListener("hashchange", onChange);
        return () => window.removeEventListener("hashchange", onChange);
    }, []);
    const navigate = useCallback((next: Route) => {
        window.location.hash = formatRoute(next);
    }, []);
    const replace = useCallback((next: Route) => {
        window.history.replaceState(null, "", formatRoute(next));
        setRoute(next);
    }, []);
    return { route, navigate, replace };
}
