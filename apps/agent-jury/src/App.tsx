import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Masthead, type NavItem } from "@/components/docket/masthead";
import { Objection } from "@/components/docket/objection";
import { Deliberating } from "@/components/docket/gavel";
import { caseNumber } from "@/screens/docket/docket-views";
import { Ticker, type TickerItem } from "@/components/docket/ticker";
import { listAgents, listJurors, type AgentRow, type JurorRow } from "@/data/directory.service";
import type { Docket } from "@/data/docket";
import { hasUserFlag, setUserFlag, USER_FLAGS } from "@/data/user-flags.service";
import { useAsync } from "@/hooks/use-async";
import { LaunchGate } from "@/launch/launch-gate";
import { docketStage, routeAfterLaunch, sessionStage } from "@/launch/launch-stages";
import { getRayfinClient, type AppRayfinClient } from "@/lib/rayfin-client";
import { formatRoute, useRoute, type Route } from "@/lib/route";
import { CaseDetail } from "@/screens/case-detail/case-detail.screen";
import { CasesScreen } from "@/screens/cases/cases.screen";
import { ClerksOffice } from "@/screens/clerks-office/clerks-office.screen";
import { useDocket, type DocketState } from "@/screens/docket/use-docket";
import { viewerFor, type Viewer } from "@/screens/docket/viewer";
import { HomeScreen } from "@/screens/home/home.screen";
import { HearingScreen } from "@/screens/hearings/hearing.screen";
import { HearingsScreen } from "@/screens/hearings/hearings.screen";
import { IntroScreen } from "@/screens/intro/intro.screen";

type Page = "home" | "cases" | "hearings" | "clerk";

function connect(): { client?: AppRayfinClient; error?: unknown } {
    try {
        return { client: getRayfinClient() };
    } catch (error) {
        return { error };
    }
}

/** Loads one agent's docket; keyed by agent so switching agents starts a fresh load. */
function WithDocket({
    client,
    requestedAgentId,
    agentId,
    jurors,
    viewer,
    children,
}: {
    client: AppRayfinClient;
    requestedAgentId?: string;
    agentId?: string;
    jurors?: JurorRow[];
    viewer: Viewer;
    children: (docket: DocketState) => ReactNode;
}) {
    const docket = useDocket(client, requestedAgentId, agentId, jurors, viewer.me);
    return <>{children(docket)}</>;
}

function tickerItems(docket: Docket | undefined, t: (key: string) => string): TickerItem[] {
    return (docket?.ticker ?? []).map(({ caseId, caseText, event }, index) => {
        const text = caseText.length > 70 ? `${caseText.slice(0, 69)}…` : caseText;
        const label = event.kind === "state" ? t(`caseState.${event.state}`) : "";
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
    // Per-user "Intro seen" flag, read in the same round as the other initial loads.
    const introFlag = useAsync(() => (client ? hasUserFlag(client, USER_FLAGS.introSeen) : Promise.resolve(true)));
    const [launched, setLaunched] = useState(false);
    const [introMarked, setIntroMarked] = useState(false);
    const [afterIntro, setAfterIntro] = useState<Route>();
    // A failed lookup counts as seen: a hiccup must not trap anyone in the Intro.
    const introSeen = introMarked || introFlag.status !== "success" || introFlag.data;
    const introChecked = introFlag.status !== "loading";

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
    const routeAgentId = route.page === "home" || route.page === "cases" || route.page === "hearings" ? route.agentId : undefined;
    const agent: AgentRow | undefined = activeAgents.find((row) => row.id === routeAgentId) ?? activeAgents[0];

    // A #clerk link waits for the jury list; non-admins then land on Home. clerkExecute is the real check.
    const page: Page | "case" | "hearing" =
        route.page === "clerk" ? (isAdmin || !jury.data ? "clerk" : "home") : route.page === "intro" ? "home" : route.page;
    const current: Page = page === "case" ? "cases" : page === "hearing" ? "hearings" : page;

    const items: NavItem<Page>[] = [
        { id: "home", label: t("nav.home") },
        { id: "cases", label: t("nav.cases") },
        { id: "hearings", label: t("nav.hearings") },
    ];
    if (isAdmin) items.push({ id: "clerk", label: t("nav.clerk") });

    function go(next: Page) {
        if (next === "clerk") navigate({ page: "clerk" });
        else if (next === "cases") navigate({ page: "cases", agentId: agent?.id, filter: "all", query: "" });
        else if (next === "hearings") navigate({ page: "hearings", agentId: agent?.id });
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

    const directoryError = jury.status === "error" ? jury.error : agentList.status === "error" ? agentList.error : undefined;
    const directoryFailed = directoryError !== undefined && (!jury.data || !agentList.data);
    const usesDocket = route.page === "home" || route.page === "cases" || route.page === "hearings" || route.page === "intro";

    // The launch screen (design guide, 6b) comes first and stays until the session and the initial load are done.
    // Its steps are the real work: the juror record (Session) and the parallel initial load (Docket).
    const launchSession = sessionStage({
        connectError: client ? undefined : (connectError ?? "No Rayfin client."),
        jury,
        hasJurorRecord: Boolean(viewer.juror),
    });
    const reloadInitialLoads = () => {
        jury.reload();
        agentList.reload();
        introFlag.reload();
    };
    const finishLaunch = () => {
        const destination = routeAfterLaunch(introSeen, route);
        setAfterIntro(destination.afterIntro);
        if (destination.route !== route) replace(destination.route);
        setLaunched(true);
    };
    const leaveIntro = () => {
        if (client && !introSeen) {
            setIntroMarked(true);
            void setUserFlag(client, USER_FLAGS.introSeen).catch((error: unknown) => console.warn("[Intro] Could not save that the intro was seen.", error));
        }
        setAfterIntro(undefined);
        replace(afterIntro ?? { page: "home", agentId: agent?.id });
    };

    if (!launched && (!client || !usesDocket || directoryFailed || (agentList.data && !agent))) {
        return (
            <LaunchGate
                session={launchSession}
                docket={docketStage({ agents: agentList, introChecked })}
                onRetry={reloadInitialLoads}
                onReady={finishLaunch}
            />
        );
    }

    const intro = route.page === "intro" ? <IntroScreen onDone={leaveIntro} /> : undefined;

    if (!client) return layout(<Objection message={t("errors.load")} technicalDetails={String(connectError)} />);
    if (page === "clerk") return layout(<ClerksOffice client={client} jury={jury} me={viewer.juror} />);

    if (directoryFailed) {
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
    if (route.page === "case") {
        return layout(<CaseDetail key={route.caseId} client={client} caseId={route.caseId} agents={agentList.data} jurors={jury.data} viewer={viewer} />);
    }
    const ready = Boolean(jury.data && agentList.data);

    if (route.page === "hearing") {
        return layout(
            <HearingScreen
                key={route.hearingId}
                client={client}
                hearingId={route.hearingId}
                agents={agentList.data}
                jurors={jury.data}
                viewer={viewer}
                onBack={() => navigate({ page: "hearings", agentId: agent?.id })}
            />,
        );
    }

    const renderPage = (docket?: DocketState) => {
        if (route.page === "hearings" && agent && docket) {
            return (
                <HearingsScreen
                    client={client}
                    agents={activeAgents}
                    agent={agent}
                    docket={docket}
                    jurors={jury.data}
                    viewer={viewer}
                    onChangeAgent={(agentId) => navigate({ page: "hearings", agentId })}
                    onOpenHearing={(hearingId) => navigate({ page: "hearing", hearingId })}
                />
            );
        }
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

    // The docket loads in the same round as the jury and agent lists: by agent when the URL names a
    // valid one, otherwise every agent's records, scoped once the first active agent is known.
    if (agentList.data && !agent) return intro ?? layout(ready ? renderPage() : <Deliberating />);
    const requestedAgentId = !agentList.data || agent?.id === routeAgentId ? routeAgentId : undefined;
    return (
        <WithDocket key={requestedAgentId ?? "all-agents"} client={client} requestedAgentId={requestedAgentId} agentId={agent?.id} jurors={jury.data} viewer={viewer}>
            {(docket) => {
                if (!launched) {
                    return (
                        <LaunchGate
                            session={launchSession}
                            docket={docketStage({ agents: agentList, docket, introChecked })}
                            onRetry={() => {
                                reloadInitialLoads();
                                docket.reload();
                            }}
                            onReady={finishLaunch}
                        />
                    );
                }
                if (intro) return intro;
                return ready && agent
                    ? layout(renderPage(docket), route.page === "home" ? <Ticker items={tickerItems(docket.data, t)} /> : undefined)
                    : layout(<Deliberating />);
            }}
        </WithDocket>
    );
}

export default App;
