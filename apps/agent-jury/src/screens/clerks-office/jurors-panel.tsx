import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { JUROR_ROLES, jurorActionsFor, type JurorRole } from "../../../rayfin/functions/src/clerk-actions";
import { ActionMenu, type ActionMenuItem } from "@/components/docket/action-menu";
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
import type { ClerkRunner } from "./clerk-runner";
import { SwearInForm } from "./swear-in-form";

interface JurorsPanelProps {
    jurors: JurorRow[];
    me: JurorRow;
    activity?: AuthorActivity;
    clerk: ClerkRunner;
    swearInClerk: ClerkRunner;
    onNotice: (message: string) => void;
}

type Filter = "active" | "inactive";
// Secondary columns give way first on narrower screens, so the table always fits its container.
const TEAM_COLUMN = "hidden min-[1024px]:table-cell";
const ACTIVITY_COLUMN = "hidden min-[1280px]:table-cell";
// Below 900 px the jurors are stacked cards, not a table.
const PHONE_QUERY = "(max-width: 899px)";

export function JurorsPanel({ jurors, me, activity, clerk, swearInClerk, onNotice }: JurorsPanelProps) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<Filter>("active");
    const [swearing, setSwearing] = useState(false);
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
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented<Filter>
                        label={t("clerk.jurors.filter")}
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: "active", label: t("clerk.jurors.active", { count: activeCount }) },
                            { value: "inactive", label: t("clerk.jurors.inactive", { count: jurors.length - activeCount }) },
                        ]}
                    />
                    <Button variant="secondary" aria-expanded={swearing} aria-controls="clerk-swear-in" onClick={() => setSwearing((value) => !value)}>
                        {t("clerk.swearIn.open")}
                    </Button>
                </div>
            </div>
            {swearing && (
                <div id="clerk-swear-in">
                    <SwearInForm
                        clerk={swearInClerk}
                        onCancel={() => setSwearing(false)}
                        onNotice={(message) => {
                            onNotice(message);
                            setSwearing(false);
                        }}
                    />
                </div>
            )}
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
                        { key: "actions", header: t("clerk.jurors.columns.actions"), hiddenHeader: true, align: "right", className: "w-[150px]" },
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

type RowProps = { juror: JurorRow } & Omit<JurorsPanelProps, "jurors" | "swearInClerk">;
type Mode = "idle" | "role" | "details";

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
                <span className="font-mono text-[13px] text-text-muted [overflow-wrap:anywhere]">{juror.email}</span>
            </span>
        </div>
    );
}

/** The one "Actions ▾" menu of a juror: Edit details, Change role and (de)activation. Your own row only offers Edit details. */
function JurorMenu({ juror, me, clerk, onNotice, onMode, fullWidth }: RowProps & { onMode: (mode: Mode) => void; fullWidth?: boolean }) {
    const { t } = useTranslation();
    const name = jurorLabel(juror);
    const allowed = jurorActionsFor(juror.id, me.id);

    async function setActive(active: boolean) {
        if (await clerk.run("setJurorActive", { jurorId: juror.id, active })) {
            onNotice(t(active ? "clerk.jurors.done.reinstated" : "clerk.jurors.done.deactivated", { name }));
        }
    }

    const items: ActionMenuItem[] = [
        { key: "details", label: t("clerk.jurors.editDetails"), ariaLabel: t("clerk.jurors.editDetailsNamed", { name }), onSelect: () => onMode("details") },
    ];
    if (allowed.canChangeRole && juror.active) {
        items.push({ key: "role", label: t("clerk.jurors.changeRole"), ariaLabel: t("clerk.jurors.changeRoleNamed", { name }), onSelect: () => onMode("role") });
    }
    if (juror.active && allowed.canDeactivate) {
        items.push({ key: "deactivate", label: t("clerk.jurors.deactivate"), ariaLabel: t("clerk.jurors.deactivateNamed", { name }), tone: "danger", disabled: clerk.pending, onSelect: () => void setActive(false) });
    }
    if (!juror.active) {
        items.push({ key: "reinstate", label: t("clerk.jurors.reinstate"), ariaLabel: t("clerk.jurors.reinstateNamed", { name }), disabled: clerk.pending, onSelect: () => void setActive(true) });
    }
    return (
        <ActionMenu
            label={t("clerk.jurors.actions")}
            ariaLabel={t("clerk.jurors.actionsFor", { name })}
            items={items}
            fullWidth={fullWidth}
            note={!allowed.canChangeRole && !allowed.canDeactivate ? t("clerk.jurors.selfNote") : undefined}
        />
    );
}

/** The forms opened from the menu. They open under the row (or inside the card), so the table never changes its width. */
function JurorEditor({ juror, clerk, onNotice, mode, onMode }: RowProps & { mode: Exclude<Mode, "idle">; onMode: (mode: Mode) => void }) {
    const { t } = useTranslation();
    const [role, setRole] = useState<JurorRole>(juror.role);
    const [displayName, setDisplayName] = useState(juror.displayName ?? "");
    const [team, setTeam] = useState(juror.team ?? "");
    const name = jurorLabel(juror);

    async function saveRole() {
        if (await clerk.run("setJurorRole", { jurorId: juror.id, role })) {
            onMode("idle");
            onNotice(t("clerk.jurors.done.roleChanged", { name, role: t(`roles.${role}.label`) }));
        }
    }

    async function saveDetails() {
        const payload = { jurorId: juror.id, displayName: displayName.trim() || undefined, team: team.trim() || undefined };
        if (await clerk.run("editJurorDetails", payload)) {
            onMode("idle");
            onNotice(t("clerk.jurors.done.detailsEdited", { name: payload.displayName ?? name }));
        }
    }

    const cancel = (
        <Button variant="link" compact onClick={() => onMode("idle")}>
            {t("clerk.jurors.cancel")}
        </Button>
    );

    if (mode === "details") {
        return (
            <div className="grid items-end gap-3 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <TextField label={t("clerk.swearIn.displayName")} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <TextField label={t("clerk.swearIn.team")} maxLength={100} value={team} onChange={(event) => setTeam(event.target.value)} />
                <div className="flex items-center gap-2">
                    <Button variant="quiet" disabled={clerk.pending} onClick={() => void saveDetails()}>
                        {t("clerk.jurors.saveDetails")}
                    </Button>
                    {cancel}
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-wrap items-end gap-3">
            <SelectField label={t("clerk.jurors.roleFor", { name })} hiddenLabel value={role} onChange={(value) => setRole(value as JurorRole)}>
                {JUROR_ROLES.map((option) => (
                    <option key={option} value={option}>
                        {t(`roles.${option}.label`)}
                    </option>
                ))}
            </SelectField>
            <Button variant="quiet" disabled={clerk.pending || role === juror.role} onClick={() => void saveRole()}>
                {t("clerk.jurors.saveRole")}
            </Button>
            {cancel}
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
    const [mode, setMode] = useState<Mode>("idle");
    return (
        <>
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
                <AdminCell className={`${ACTIVITY_COLUMN} text-text-muted`}>{activityText(juror, activity, t)}</AdminCell>
                <AdminCell align="right">
                    <JurorMenu {...props} onMode={setMode} />
                </AdminCell>
            </AdminRow>
            {mode !== "idle" && (
                <tr className="bg-paper">
                    <td colSpan={5} className="px-3.5 pb-4 pt-1">
                        <JurorEditor {...props} mode={mode} onMode={setMode} />
                    </td>
                </tr>
            )}
        </>
    );
}

/** Phone layout: identity, role chip, then a full-width Actions menu. */
function JurorCard(props: RowProps) {
    const { juror } = props;
    const [mode, setMode] = useState<Mode>("idle");
    return (
        <li className="flex flex-col gap-3 border border-ink bg-paper-raised p-4">
            <JurorIdentity juror={juror} me={props.me} />
            <div className="flex flex-wrap gap-2">
                <RoleChip role={juror.role} />
            </div>
            <JurorMenu {...props} onMode={setMode} fullWidth />
            {mode !== "idle" && <JurorEditor {...props} mode={mode} onMode={setMode} />}
        </li>
    );
}
