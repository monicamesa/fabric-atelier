import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Masthead, type NavItem } from "@/components/docket/masthead";
import { Objection } from "@/components/docket/objection";
import { PageHeader } from "@/components/docket/page-header";
import { Button } from "@/components/docket/button";
import { EmptyState } from "@/components/docket/states";
import { listJurors, type JurorRow } from "@/data/directory.service";
import { useAsync } from "@/hooks/use-async";
import { getRayfinClient, type AppRayfinClient } from "@/lib/rayfin-client";
import { ClerksOffice } from "@/screens/clerks-office/clerks-office.screen";

type Page = "home" | "clerk";

function connect(): { client?: AppRayfinClient; error?: unknown } {
    try {
        return { client: getRayfinClient() };
    } catch (error) {
        return { error };
    }
}

function App() {
    const { t } = useTranslation();
    const [{ client, error: connectError }] = useState(connect);
    const [page, setPage] = useState<Page>(() => (window.location.hash === "#clerk" ? "clerk" : "home"));
    const jury = useAsync(() => (client ? listJurors(client) : Promise.reject(connectError)));

    const me: JurorRow | undefined = useMemo(() => {
        const email = client?.auth.getSession().user?.email?.toLowerCase();
        return email ? jury.data?.find((juror) => juror.email.toLowerCase() === email) : undefined;
    }, [client, jury.data]);
    const isAdmin = me?.active === true && me.role === "admin";

    const items: NavItem<Page>[] = [{ id: "home", label: t("nav.home") }];
    if (isAdmin || page === "clerk") items.push({ id: "clerk", label: t("nav.clerk") });

    function navigate(next: Page) {
        setPage(next);
        window.history.replaceState(null, "", `#${next}`);
    }

    return (
        <div className="min-h-full bg-paper text-text">
            <Masthead items={items} current={page} onNavigate={navigate} />
            <main className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pb-8 pt-5 sm:px-6">
                {!client ? (
                    <Objection message={t("errors.load")} technicalDetails={String(connectError)} />
                ) : page === "clerk" ? (
                    <ClerksOffice client={client} jury={jury} me={me} />
                ) : (
                    <>
                        <PageHeader kicker={t("app.title")} title={t("home.title")} help={t("home.help")} />
                        <EmptyState
                            message={t("home.empty")}
                            action={
                                isAdmin ? (
                                    <Button variant="secondary" onClick={() => navigate("clerk")}>
                                        {t("home.openClerk")}
                                    </Button>
                                ) : undefined
                            }
                        />
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
