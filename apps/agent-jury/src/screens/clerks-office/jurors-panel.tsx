import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { JUROR_ROLES, jurorActionsFor, type JurorRole } from "../../../rayfin/functions/src/clerk-actions";
import { AdminCell, AdminRow, AdminTable } from "@/components/docket/admin-table";
import { Button } from "@/components/docket/button";
import { RoleChip } from "@/components/docket/chip";
import { SelectField, TextField } from "@/components/docket/field";
import { Avatar } from "@/components/docket/identity";
import { Segmented } from "@/components/docket/segmented";
import { EmptyState } from "@/components/docket/states";
import type { AuthorActivity, JurorRow } from "@/data/directory.service";
import { useMediaQuery } from "@/hooks/use-media-query";
import { jurorLabel } from "@/lib/people";
import { cn } from "@/lib/utils";
import type { ClerkRunner } from "./clerk-runner";

interface JurorsPanelProps {
    jurors: JurorRow[];
    me: JurorRow;
    activity?: AuthorActivity;
    clerk: ClerkRunner;
    onNotice: (message: string) => void;
}

type Filter = "active" | "inactive";
// Secondary columns give way first on narrower screens, so the row actions always fit on one line.
const TEAM_COLUMN = "hidden min-[1024px]:table-cell";
const ACTIVITY_COLUMN = "hidden min-[1280px]:max-[1439px]:table-cell min-[1600px]:table-cell";
// The table needs room for its one-line actions: below 900 px the jurors are stacked cards, not a table.
const PHONE_QUERY = "(max-width: 899px)";

export function JurorsPanel({ jurors, me, activity, clerk, onNotice }: JurorsPanelProps) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<Filter>("active");
    const isPhone = useMediaQuery(PHONE_QUERY);
    const activeCount = jurors.filter((juror) => juror.active).length;
    const shown = jurors.filter((juror) => juror.active === (filter === "active"));
    const rowProps = { me, activity, clerk, onNotice };

    return (
        <section aria-labelledby="clerk-jurors-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="clerk-jurors-title" className="m-0 font-serif text-[28px] font-bold text-ink">
                    {t("clerk.jurors.title")}
                </h2>
                <Segmented<Filter>
                    label={t("clerk.jurors.filter")}
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: "active", label: t("clerk.jurors.active", { count: activeCount }) },
                        { value: "inactive", label: t("clerk.jurors.inactive", { count: jurors.length - activeCount }) },
                    ]}
                />
            </div>
            {shown.length === 0 ? (
                <EmptyState message={t(filter === "active" ? "clerk.jurors.emptyActive" : "clerk.jurors.emptyInactive")} />
            ) : isPhone ? (
                <ul aria-label={t("clerk.jurors.caption")} className="m-0 flex list-none flex-col gap-3 p-0">
                    {shown.map((juror) => (
                        <JurorCard key={juror.id} juror={juror} {...rowProps} />
                    ))}
                </ul>
            ) : (
                <AdminTable
                    caption={t("clerk.jurors.caption")}
                    columns={[
                        { key: "juror", header: t("clerk.jurors.columns.juror") },
                        { key: "team", header: t("clerk.jurors.columns.team"), className: TEAM_COLUMN },
                        { key: "role", header: t("clerk.jurors.columns.role"), className: "w-[150px]" },
                        { key: "activity", header: t("clerk.jurors.columns.activity"), className: ACTIVITY_COLUMN },
                        {
                            key: "actions",
                            header: t("clerk.jurors.columns.actions"),
                            hiddenHeader: true,
                            align: "right",
                            className: "w-[340px]",
                        },
                    ]}
                >
                    {shown.map((juror) => (
                        <JurorTableRow key={juror.id} juror={juror} {...rowProps} />
                    ))}
                </AdminTable>
            )}
            <p className="m-0 text-[14px] leading-normal text-text-muted">{t("clerk.jurors.footnote")}</p>
        </section>
    );
}

type RowProps = { juror: JurorRow } & Omit<JurorsPanelProps, "jurors">;

function JurorIdentity({ juror, me }: Pick<RowProps, "juror" | "me">) {
    const { t } = useTranslation();
    const name = jurorLabel(juror);
    const isMe = juror.id.toLowerCase() === me.id.toLowerCase();
    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar id={juror.id} label={name} inactive={!juror.active} />
            <span className="flex min-w-0 flex-col">
                <b className="text-ink">
                    {name}
                    {isMe && ` ${t("clerk.jurors.you")}`}
                </b>
                <span className="font-mono text-[13px] text-text-muted [overflow-wrap:anywhere] min-[640px]:whitespace-nowrap">
                    {juror.email}
                </span>
            </span>
        </div>
    );
}

/** "Edit details", "Change role" and (de)activation. Your own row only offers "Edit details". */
function JurorActions({ juror, me, clerk, onNotice, stacked = false }: RowProps & { stacked?: boolean }) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<"idle" | "role" | "details">("idle");
    const [role, setRole] = useState<JurorRole>(juror.role);
    const [displayName, setDisplayName] = useState(juror.displayName ?? "");
    const [team, setTeam] = useState(juror.team ?? "");
    const name = jurorLabel(juror);
    const allowed = jurorActionsFor(juror.id, me.id);
    const full = stacked ? "w-full" : undefined;
    const layout = cn("flex gap-2", stacked ? "flex-col" : "flex-wrap items-center justify-end");
    // The idle actions of a table row stay on one line (never clipped, never stacked); the edit forms may wrap.
    const idleLayout = cn("flex gap-2", stacked ? "flex-col" : "flex-nowrap items-center justify-end whitespace-nowrap");

    async function saveRole() {
        if (await clerk.run("setJurorRole", { jurorId: juror.id, role })) {
            setMode("idle");
            onNotice(t("clerk.jurors.done.roleChanged", { name, role: t(`roles.${role}.label`) }));
        }
    }

    async function saveDetails() {
        const payload = { jurorId: juror.id, displayName: displayName.trim() || undefined, team: team.trim() || undefined };
        if (await clerk.run("editJurorDetails", payload)) {
            setMode("idle");
            onNotice(t("clerk.jurors.done.detailsEdited", { name: payload.displayName ?? name }));
        }
    }

    async function setActive(active: boolean) {
        if (await clerk.run("setJurorActive", { jurorId: juror.id, active })) {
            onNotice(t(active ? "clerk.jurors.done.reinstated" : "clerk.jurors.done.deactivated", { name }));
        }
    }

    function cancel() {
        setRole(juror.role);
        setDisplayName(juror.displayName ?? "");
        setTeam(juror.team ?? "");
        setMode("idle");
    }

    const cancelButton = (
        <Button variant="link" compact={!stacked} className={full} onClick={cancel}>
            {t("clerk.jurors.cancel")}
        </Button>
    );

    if (mode === "details") {
        return (
            <div className={cn("flex flex-col gap-2", !stacked && "items-stretch text-left")}>
                <TextField
                    label={t("clerk.swearIn.displayName")}
                    maxLength={100}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                />
                <TextField label={t("clerk.swearIn.team")} maxLength={100} value={team} onChange={(event) => setTeam(event.target.value)} />
                <div className={layout}>
                    <Button variant="quiet" compact={!stacked} className={full} disabled={clerk.pending} onClick={() => void saveDetails()}>
                        {t("clerk.jurors.saveDetails")}
                    </Button>
                    {cancelButton}
                </div>
            </div>
        );
    }

    if (mode === "role") {
        return (
            <div className={layout}>
                <SelectField
                    label={t("clerk.jurors.roleFor", { name })}
                    hiddenLabel
                    value={role}
                    onChange={(value) => setRole(value as JurorRole)}
                    className={full}
                >
                    {JUROR_ROLES.map((option) => (
                        <option key={option} value={option}>
                            {t(`roles.${option}.label`)}
                        </option>
                    ))}
                </SelectField>
                <Button
                    variant="quiet"
                    compact={!stacked}
                    className={full}
                    disabled={clerk.pending || role === juror.role}
                    onClick={() => void saveRole()}
                >
                    {t("clerk.jurors.saveRole")}
                </Button>
                {cancelButton}
            </div>
        );
    }

    const textAction = cn(full, !stacked && "text-ink");
    return (
        <div className={idleLayout}>
            <Button
                variant={stacked ? "quiet" : "link"}
                compact={!stacked}
                className={textAction}
                onClick={() => setMode("details")}
                aria-label={t("clerk.jurors.editDetailsNamed", { name })}
            >
                {t("clerk.jurors.editDetails")}
            </Button>
            {!allowed.canChangeRole && !allowed.canDeactivate && (
                <span className="text-[13px] text-text-muted">{t("clerk.jurors.selfNote")}</span>
            )}
            {allowed.canChangeRole && juror.active && (
                <Button
                    variant={stacked ? "quiet" : "link"}
                    compact={!stacked}
                    className={textAction}
                    onClick={() => setMode("role")}
                    aria-label={t("clerk.jurors.changeRoleNamed", { name })}
                >
                    {t("clerk.jurors.changeRole")}
                </Button>
            )}
            {juror.active
                ? allowed.canDeactivate && (
                      <Button
                          variant="danger-text"
                          compact={!stacked}
                          className={cn(full, stacked && "border border-action")}
                          disabled={clerk.pending}
                          onClick={() => void setActive(false)}
                          aria-label={t("clerk.jurors.deactivateNamed", { name })}
                      >
                          {t("clerk.jurors.deactivate")}
                      </Button>
                  )
                : (
                      <Button
                          variant="quiet"
                          compact={!stacked}
                          className={full}
                          disabled={clerk.pending}
                          onClick={() => void setActive(true)}
                          aria-label={t("clerk.jurors.reinstateNamed", { name })}
                      >
                          {t("clerk.jurors.reinstate")}
                      </Button>
                  )}
        </div>
    );
}

function activityText(juror: JurorRow, activity: AuthorActivity | undefined, t: TFunction) {
    if (!activity) return "—";
    const email = juror.email.toLowerCase();
    const cases = activity.casesByEmail.get(email) ?? 0;
    const answers = activity.testimoniesByEmail.get(email) ?? 0;
    return cases + answers === 0
        ? t("clerk.jurors.noActivity")
        : `${t("clerk.jurors.activityCases", { count: cases })} · ${t("clerk.jurors.activityAnswers", { count: answers })}`;
}

function JurorTableRow(props: RowProps) {
    const { t } = useTranslation();
    const { juror, activity } = props;
    return (
        <AdminRow>
            <AdminCell>
                <JurorIdentity juror={juror} me={props.me} />
            </AdminCell>
            <AdminCell className={TEAM_COLUMN}>
                <span className="block max-w-[160px] truncate" title={juror.team ?? undefined}>
                    {juror.team ?? "—"}
                </span>
            </AdminCell>
            <AdminCell>
                <RoleChip role={juror.role} />
            </AdminCell>
            <AdminCell className={`${ACTIVITY_COLUMN} whitespace-nowrap text-text-muted`}>{activityText(juror, activity, t)}</AdminCell>
            <AdminCell align="right">
                <JurorActions {...props} />
            </AdminCell>
        </AdminRow>
    );
}

/** Phone layout: identity, role chip, then full-width actions. */
function JurorCard(props: RowProps) {
    const { juror } = props;
    return (
        <li className="flex flex-col gap-3 border border-ink bg-paper-raised p-4">
            <JurorIdentity juror={juror} me={props.me} />
            <div className="flex flex-wrap gap-2">
                <RoleChip role={juror.role} />
            </div>
            <JurorActions {...props} stacked />
        </li>
    );
}
