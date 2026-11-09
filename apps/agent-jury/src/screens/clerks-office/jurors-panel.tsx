import { useState } from "react";
import { useTranslation } from "react-i18next";
import { JUROR_ROLES, jurorActionsFor, type JurorRole } from "../../../rayfin/functions/src/clerk-actions";
import { AdminCell, AdminRow, AdminTable } from "@/components/docket/admin-table";
import { Button } from "@/components/docket/button";
import { RoleChip } from "@/components/docket/chip";
import { CompactSelect } from "@/components/docket/field";
import { Avatar } from "@/components/docket/identity";
import { Segmented } from "@/components/docket/segmented";
import { EmptyState } from "@/components/docket/states";
import type { AuthorActivity, JurorRow } from "@/data/directory.service";
import { jurorLabel } from "@/lib/people";
import type { ClerkRunner } from "./clerk-runner";

interface JurorsPanelProps {
    jurors: JurorRow[];
    me: JurorRow;
    activity?: AuthorActivity;
    clerk: ClerkRunner;
    onNotice: (message: string) => void;
}

type Filter = "active" | "inactive";
// Team and activity give way first on narrow screens, so the row actions stay visible.
const SECONDARY = "hidden min-[1200px]:table-cell";

export function JurorsPanel({ jurors, me, activity, clerk, onNotice }: JurorsPanelProps) {
    const { t } = useTranslation();
    const [filter, setFilter] = useState<Filter>("active");
    const activeCount = jurors.filter((juror) => juror.active).length;
    const shown = jurors.filter((juror) => juror.active === (filter === "active"));

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
            ) : (
                <AdminTable
                    caption={t("clerk.jurors.caption")}
                    columns={[
                        { key: "juror", header: t("clerk.jurors.columns.juror") },
                        { key: "team", header: t("clerk.jurors.columns.team"), className: SECONDARY },
                        { key: "role", header: t("clerk.jurors.columns.role") },
                        { key: "activity", header: t("clerk.jurors.columns.activity"), className: SECONDARY },
                        { key: "actions", header: t("clerk.jurors.columns.actions"), hiddenHeader: true, align: "right" },
                    ]}
                >
                    {shown.map((juror) => (
                        <JurorTableRow key={juror.id} juror={juror} me={me} activity={activity} clerk={clerk} onNotice={onNotice} />
                    ))}
                </AdminTable>
            )}
            <p className="m-0 text-[14px] leading-normal text-text-muted">{t("clerk.jurors.footnote")}</p>
        </section>
    );
}

function JurorTableRow({ juror, me, activity, clerk, onNotice }: { juror: JurorRow } & Omit<JurorsPanelProps, "jurors">) {
    const { t } = useTranslation();
    const [role, setRole] = useState<JurorRole>(juror.role);
    const name = jurorLabel(juror);
    const isMe = juror.id.toLowerCase() === me.id.toLowerCase();
    const allowed = jurorActionsFor(juror.id, me.id);
    const email = juror.email.toLowerCase();
    const cases = activity?.casesByEmail.get(email) ?? 0;
    const answers = activity?.testimoniesByEmail.get(email) ?? 0;

    async function saveRole() {
        if (await clerk.run("setJurorRole", { jurorId: juror.id, role })) {
            onNotice(t("clerk.jurors.done.roleChanged", { name, role: t(`roles.${role}.label`) }));
        }
    }

    async function setActive(active: boolean) {
        if (await clerk.run("setJurorActive", { jurorId: juror.id, active })) {
            onNotice(t(active ? "clerk.jurors.done.reinstated" : "clerk.jurors.done.deactivated", { name }));
        }
    }

    return (
        <AdminRow>
            <AdminCell>
                <div className="flex items-center gap-3">
                    <Avatar label={name} inactive={!juror.active} />
                    <span className="flex min-w-0 flex-col">
                        <b className="text-ink">
                            {name}
                            {isMe && ` ${t("clerk.jurors.you")}`}
                        </b>
                        <span className="whitespace-nowrap font-mono text-[13px] text-text-muted">{juror.email}</span>
                    </span>
                </div>
            </AdminCell>
            <AdminCell className={SECONDARY}>{juror.team ?? "—"}</AdminCell>
            <AdminCell>
                <RoleChip role={juror.role} />
            </AdminCell>
            <AdminCell className={`${SECONDARY} whitespace-nowrap text-text-muted`}>
                {activity
                    ? cases + answers === 0
                        ? t("clerk.jurors.noActivity")
                        : `${t("clerk.jurors.activityCases", { count: cases })} · ${t("clerk.jurors.activityAnswers", { count: answers })}`
                    : "—"}
            </AdminCell>
            <AdminCell align="right">
                {isMe ? (
                    <span className="text-[13px] text-text-muted">{t("clerk.jurors.selfNote")}</span>
                ) : (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {allowed.canChangeRole && juror.active && (
                            <>
                                <CompactSelect
                                    label={t("clerk.jurors.roleFor", { name })}
                                    value={role}
                                    onChange={(value) => setRole(value as JurorRole)}
                                >
                                    {JUROR_ROLES.map((option) => (
                                        <option key={option} value={option}>
                                            {t(`roles.${option}.label`)}
                                        </option>
                                    ))}
                                </CompactSelect>
                                {role !== juror.role && (
                                    <Button variant="quiet" compact disabled={clerk.pending} onClick={() => void saveRole()}>
                                        {t("clerk.jurors.saveRole")}
                                    </Button>
                                )}
                            </>
                        )}
                        {juror.active
                            ? allowed.canDeactivate && (
                                  <Button
                                      variant="danger-text"
                                      compact
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
                                      compact
                                      disabled={clerk.pending}
                                      onClick={() => void setActive(true)}
                                      aria-label={t("clerk.jurors.reinstateNamed", { name })}
                                  >
                                      {t("clerk.jurors.reinstate")}
                                  </Button>
                              )}
                    </div>
                )}
            </AdminCell>
        </AdminRow>
    );
}
