import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Masthead, type NavItem } from "@/components/docket/masthead";
import { Objection } from "@/components/docket/objection";
import { Deliberating } from "@/components/docket/gavel";
import { caseNumber } from "@/screens/docket/docket-views";
import { Ticker, type TickerItem } from "@/components/docket/ticker";
import { listAgents, listJurors, type AgentRow, type JurorRow } from "@/data/directory.service";
import type { Docket } from "@/data/docket";
import { useAsync } from "@/hooks/use-async";
import { getRayfinClient, type AppRayfinClient } from "@/lib/rayfin-client";
import { formatRoute, useRoute, type Route } from "@/lib/route";
import { CaseDetail } from "@/screens/case-detail/case-detail.screen";
import { CasesScreen } from "@/screens/cases/cases.screen";
import { ClerksOffice } from "@/screens/clerks-office/clerks-office.screen";
import { useDocket, type DocketState } from "@/screens/docket/use-docket";
import { viewerFor, type Viewer } from "@/screens/docket/viewer";
import { HomeScreen } from "@/screens/home/home.screen";

type Page = "home" | "cases" | "clerk";

function connect(): { client?: AppRayfinClient; error?: unknown } {
    try {
        return { client: getRayfinClient() };
    } catch (error) {
        return { error };
    }
}

const EMPTY_JURORS: JurorRow[] = [];

/** Loads one agent's docket; keyed by agent so switching agents starts a fresh load. */
function WithDocket({
    client,
    agentId,
    jurors,
    viewer,
    children,
}: {
    client: AppRayfinClient;
    agentId: string;
    jurors: JurorRow[];
    viewer: Viewer;
    children: (docket: DocketState) => ReactNode;
}) {
    const docket = useDocket(client, agentId, jurors, viewer.me);
    return <>{children(docket)}</>;
}

function tickerItems(docket: Docket | undefined, t: (key: string) => string): TickerItem[] {
    return (docket?.ticker ?? []).map(({ caseId, caseText, event }, index) => {
        const text = caseText.length > 70 ? `${caseText.slice(0, 69)}…` : caseText;
        const label = event.kind === "state" ? t(`caseState.${event.state}`) : t("ticker.proposed");
        return {
            key: `${caseId}-${index}`,
            href: formatRoute({ page: "case", caseId }),
            content: (
                <>
                    <b className="font-bold uppercase text-overruled">{label}</b> · {caseNumber(caseId)} “{text}”
                </>
            ),
        };
    });
}

function App() {
    const { t } = useTranslation();
    const [{ client, error: connectError }] = useState(connect);
    const { route, navigate, replace } = useRoute();
    const jury = useAsync(() => (client ? listJurors(client) : Promise.reject(connectError)));
    const agentList = useAsync(() => (client ? listAgents(client) : Promise.reject(connectError)));

    const jurors = jury.data ?? EMPTY_JURORS;
    const session = client?.auth.getSession();
    const sessionUserId = session?.isAuthenticated ? session.user?.id : undefined;
    const sessionEmail = session?.isAuthenticated ? session.user?.email : undefined;
    const viewer = useMemo(
        () => viewerFor({ isAuthenticated: Boolean(sessionUserId), user: { id: sessionUserId, email: sessionEmail } }, jury.data),
        [sessionUserId, sessionEmail, jury.data],
    );
    const isAdmin = viewer.isAdmin;
    const activeAgents = useMemo(() => (agentList.data ?? []).filter((agent) => agent.active), [agentList.data]);

    // D6: the agent lives in the URL; the default is the first active agent by name.
    const routeAgentId = route.page === "home" || route.page === "cases" ? route.agentId : undefined;
    const agent: AgentRow | undefined = activeAgents.find((row) => row.id === routeAgentId) ?? activeAgents[0];

    // A #clerk link waits for the jury list; non-admins then land on Home. clerkExecute is the real check.
    const page: Page | "case" = route.page === "clerk" ? (isAdmin || !jury.data ? "clerk" : "home") : route.page;
    const current: Page = page === "case" ? "cases" : page;

    const items: NavItem<Page>[] = [
        { id: "home", label: t("nav.home") },
        { id: "cases", label: t("nav.cases") },
    ];
    if (isAdmin) items.push({ id: "clerk", label: t("nav.clerk") });

    function go(next: Page) {
        if (next === "clerk") navigate({ page: "clerk" });
        else if (next === "cases") navigate({ page: "cases", agentId: agent?.id, filter: "all", query: "" });
        else navigate({ page: "home", agentId: agent?.id });
    }
    const openCase = (caseId: string) => navigate({ page: "case", caseId });

    function layout(content: ReactNode, ticker?: ReactNode) {
        return (
            <div className="min-h-full bg-paper text-text">
                {ticker}
                <Masthead items={items} current={current} onNavigate={go} />
                <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pb-10 pt-5 sm:px-6">{content}</main>
            </div>
        );
    }

    if (!client) return layout(<Objection message={t("errors.load")} technicalDetails={String(connectError)} />);
    if (page === "clerk") return layout(<ClerksOffice client={client} jury={jury} me={viewer.juror} />);

    const directoryError = jury.status === "error" ? jury.error : agentList.status === "error" ? agentList.error : undefined;
    if (directoryError !== undefined && (!jury.data || !agentList.data)) {
        return layout(
            <Objection
                message={t("errors.load")}
                technicalDetails={String(directoryError)}
                onRetry={() => {
                    jury.reload();
                    agentList.reload();
                }}
            />,
        );
    }
    if (!jury.data || !agentList.data) return layout(<Deliberating />);

    if (route.page === "case") {
        return layout(<CaseDetail key={route.caseId} client={client} caseId={route.caseId} agents={agentList.data} jurors={jurors} viewer={viewer} />);
    }

    const renderPage = (docket?: DocketState) => {
        if (route.page === "cases" && agent && docket) {
            return (
                <CasesScreen
                    client={client}
                    agents={activeAgents}
                    agent={agent}
                    docket={docket}
                    viewer={viewer}
                    filter={route.filter}
                    query={route.query}
                    onOpenCase={openCase}
                    onRouteChange={(next, quiet) => {
                        const target: Route = {
                            page: "cases",
                            agentId: next.agentId ?? agent.id,
                            filter: next.filter ?? route.filter,
                            query: next.query ?? route.query,
                        };
                        if (quiet) replace(target);
                        else navigate(target);
                    }}
                />
            );
        }
        return (
            <HomeScreen
                client={client}
                agents={activeAgents}
                agent={agent}
                docket={docket}
                viewer={viewer}
                onAgentChange={(agentId) => navigate({ page: "home", agentId })}
                onOpenCase={openCase}
                onOpenClerk={() => navigate({ page: "clerk" })}
            />
        );
    };

    if (!agent) return layout(renderPage());
    return (
        <WithDocket key={agent.id} client={client} agentId={agent.id} jurors={jurors} viewer={viewer}>
            {(docket) => layout(renderPage(docket), route.page === "home" ? <Ticker items={tickerItems(docket.data, t)} /> : undefined)}
        </WithDocket>
    );
}

export default App;
