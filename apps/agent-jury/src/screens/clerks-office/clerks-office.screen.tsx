import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { Objection } from "@/components/docket/objection";
import { PageHeader } from "@/components/docket/page-header";
import { LoadingLine, Skeleton } from "@/components/docket/states";
import { Tabs } from "@/components/docket/tabs";
import { readAdminLog } from "@/data/clerk.service";
import { describeClerkError } from "@/data/clerk-errors";
import { listAgents, readAuthorActivity, type JurorRow } from "@/data/directory.service";
import { useAsync, type AsyncState } from "@/hooks/use-async";
import { useClerkAction } from "@/hooks/use-clerk-action";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { AdminLogPanel, LatestChanges, type LogState } from "./admin-log";
import { AgentsPanel } from "./agents-panel";
import { ClerkError, ClerkNotice } from "./clerk-feedback";
import { JurorsPanel } from "./jurors-panel";
import { describeLogEntry } from "./log-entry";
import { SwearInForm } from "./swear-in-form";

type Tab = "jurors" | "agents" | "log";
const LOG_SIZE = 50;

interface ClerksOfficeProps {
    client: AppRayfinClient;
    jury: AsyncState<JurorRow[]> & { reload: () => void };
    me: JurorRow | undefined;
}

function technical(error: unknown): string | undefined {
    return error === undefined ? undefined : describeClerkError(error).technicalDetails;
}

export function ClerksOffice({ client, jury, me }: ClerksOfficeProps) {
    const { t } = useTranslation();
    const isAdmin = me?.active === true && me.role === "admin";

    const header = (
        <PageHeader
            kicker={t("clerk.kicker")}
            title={t("clerk.title")}
            help={t("clerk.help")}
            aside={
                <div className="flex items-start gap-3 border border-ink bg-paper-raised px-4 py-3.5 text-[14px] leading-normal text-text">
                    <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink" />
                    <span>
                        <b className="text-ink">{t("clerk.protectedTitle")}</b> {t("clerk.protectedBody")}
                    </span>
                </div>
            }
        />
    );

    if (!jury.data) {
        return (
            <div className="flex flex-col gap-6">
                {header}
                {jury.status === "error" ? (
                    <Objection message={t("errors.load")} technicalDetails={technical(jury.error)} onRetry={jury.reload} />
                ) : (
                    <div className="flex flex-col gap-3">
                        <LoadingLine>{t("clerk.loading")}</LoadingLine>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-3/4" />
                    </div>
                )}
            </div>
        );
    }

    if (!isAdmin || !me) {
        return (
            <div className="flex flex-col gap-6">
                {header}
                <p role="note" className="m-0 border-2 border-ink bg-paper-raised p-5 text-[16px] text-text">
                    {t("clerk.notAdmin")}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {header}
            <AdminDesk client={client} jury={jury} jurors={jury.data} me={me} />
        </div>
    );
}

/** Loaded only for active admins, so non-admins never send admin requests. */
function AdminDesk({ client, jury, jurors, me }: { client: AppRayfinClient; jury: { reload: () => void }; jurors: JurorRow[]; me: JurorRow }) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>("jurors");
    const [notice, setNotice] = useState<string | null>(null);

    const agents = useAsync(() => listAgents(client));
    const activity = useAsync(() => readAuthorActivity(client));
    const log = useAsync(() => readAdminLog(client, LOG_SIZE));

    const reloadJury = jury.reload;
    const reloadAgents = agents.reload;
    const reloadLog = log.reload;
    const reloadAll = useCallback(() => {
        reloadJury();
        reloadAgents();
        reloadLog();
    }, [reloadJury, reloadAgents, reloadLog]);

    const rowClerk = useClerkAction(client, reloadAll);
    const swearInClerk = useClerkAction(client, reloadAll);
    const agentClerk = useClerkAction(client, reloadAll);
    const registerClerk = useClerkAction(client, reloadAll);

    const logState: LogState = useMemo(
        () => ({
            status: log.status,
            lines: log.data?.map((entry) => describeLogEntry(entry, jurors, agents.data ?? [], t)),
            technicalDetails: technical(log.error),
            reload: log.reload,
        }),
        [log.status, log.data, log.error, log.reload, jurors, agents.data, t],
    );

    const showNotice = (message: string) => setNotice(message);

    return (
        <>
            <Tabs<Tab>
                label={t("clerk.tabs.label")}
                idPrefix="clerk"
                selected={tab}
                onSelect={(next) => {
                    setTab(next);
                    setNotice(null);
                }}
                tabs={[
                    { id: "jurors", label: t("clerk.tabs.jurors", { count: jurors.length }) },
                    { id: "agents", label: agents.data ? t("clerk.tabs.agents", { count: agents.data.length }) : t("clerk.tabs.agentsPlain") },
                    { id: "log", label: t("clerk.tabs.log") },
                ]}
            />
            <ClerkNotice message={notice} />

            <div id={`clerk-panel-${tab}`} role="tabpanel" aria-labelledby={`clerk-tab-${tab}`} tabIndex={0}>
                {tab === "jurors" && (
                    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-10 min-[900px]:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="flex flex-col gap-3">
                            <ClerkError view={rowClerk.error} />
                            <JurorsPanel jurors={jurors} me={me} activity={activity.data} clerk={rowClerk} onNotice={showNotice} />
                        </div>
                        <aside className="flex flex-col gap-6">
                            <SwearInForm clerk={swearInClerk} onNotice={showNotice} />
                            <LatestChanges log={logState} onOpenLog={() => setTab("log")} />
                        </aside>
                    </div>
                )}
                {tab === "agents" &&
                    (agents.data ? (
                        <AgentsPanel
                            agents={agents.data}
                            activity={activity.data}
                            clerk={agentClerk}
                            registerClerk={registerClerk}
                            onNotice={showNotice}
                        />
                    ) : agents.status === "error" ? (
                        <Objection message={t("errors.load")} technicalDetails={technical(agents.error)} onRetry={agents.reload} />
                    ) : (
                        <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
                            <LoadingLine>{t("clerk.loading")}</LoadingLine>
                            <Skeleton className="col-start-1 h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </div>
                    ))}
                {tab === "log" && <AdminLogPanel log={logState} />}
            </div>
        </>
    );
}
