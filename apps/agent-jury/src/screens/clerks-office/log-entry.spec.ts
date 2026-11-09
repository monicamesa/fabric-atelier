import { beforeAll, describe, expect, it } from "vitest";
import type { AdminLogEntry } from "../../../rayfin/functions/src/clerk-actions";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { i18n, initI18n } from "@/i18n/i18n";
import { describeLogEntry, visibleLogLines } from "./log-entry";

const jurors: JurorRow[] = [
    { id: "00000000-0000-4000-8000-000000000014", email: "dario.admin@example.com", displayName: null, role: "admin", active: true },
    { id: "00000000-0000-4000-8000-000000000011", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", active: true },
];
const agents: AgentRow[] = [
    { id: "00000000-0000-4000-8000-000000000021", name: "Sales agent (example)", workspaceId: "w", itemId: "i", active: true },
];

const entry = (fields: Partial<AdminLogEntry>): AdminLogEntry => ({
    requestId: "r1",
    action: "readAdminLog",
    payload: "{}",
    requesterEmail: "dario.admin@example.com",
    outcome: "done",
    reason: "ok",
    detail: "",
    processedAt: "2026-11-09T10:00:00.000Z",
    automatedCheck: false,
    ...fields,
});

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("describeLogEntry", () => {
    const t = i18n.t.bind(i18n);

    it("describes a sworn-in juror without showing their email", () => {
        const line = describeLogEntry(
            entry({ action: "swearInJuror", payload: JSON.stringify({ email: "new.juror@example.com", role: "approver" }) }),
            jurors,
            agents,
            t,
        );
        expect(line.text).toBe("dario.admin swore in new.juror as Approver");
        expect(line.rejected).toBe(false);
    });

    it("resolves juror and agent ids to names", () => {
        expect(
            describeLogEntry(entry({ action: "setJurorRole", payload: JSON.stringify({ jurorId: jurors[1].id.toUpperCase(), role: "admin" }) }), jurors, agents, t)
                .text,
        ).toBe("dario.admin made Ana E. Admin");
        expect(
            describeLogEntry(entry({ action: "setAgentActive", payload: JSON.stringify({ agentId: agents[0].id, active: false }) }), jurors, agents, t).text,
        ).toBe("dario.admin retired the agent Sales agent (example)");
        expect(
            describeLogEntry(entry({ action: "editJurorDetails", payload: JSON.stringify({ jurorId: jurors[1].id, team: "Sales" }) }), jurors, agents, t).text,
        ).toBe("dario.admin edited the details of Ana E.");
    });

    it("marks rejected attempts with their reason", () => {
        const line = describeLogEntry(
            entry({
                action: "setJurorActive",
                payload: JSON.stringify({ jurorId: jurors[0].id, active: false }),
                outcome: "rejected",
                reason: "self_protection",
            }),
            jurors,
            agents,
            t,
        );
        expect(line.rejected).toBe(true);
        expect(line.text).toBe("Rejected: dario.admin tried to deactivate dario.admin (admins can't remove themselves)");
    });

    it("copes with unknown actions, broken payloads and unknown reasons", () => {
        const line = describeLogEntry(entry({ action: "dropTables", payload: "not json", outcome: "rejected", reason: "weird" }), jurors, agents, t);
        expect(line.text).toBe("Rejected: dario.admin sent a request the office doesn't know (could not be applied)");
    });

    it("reads I1a rows written before the reason column existed", () => {
        const line = describeLogEntry(
            entry({ action: "probe", outcome: "rejected", reason: "", detail: "The requester is not an active admin." }),
            jurors,
            agents,
            t,
        );
        expect(line.text).toBe("Rejected: dario.admin sent a test request (not an active admin)");
    });
});

describe("automated check filter", () => {
    const t = i18n.t.bind(i18n);
    const check = entry({ requestId: "check", payload: JSON.stringify({ limit: 1, source: "check" }), automatedCheck: true });
    const real = entry({ requestId: "real", action: "setJurorRole", payload: JSON.stringify({ jurorId: jurors[1].id, role: "approver" }) });
    // clerkExecute never flags a non-admin's request, even when it carries the marker.
    const intruder = entry({
        requestId: "intruder",
        requesterEmail: "intruder@example.com",
        payload: JSON.stringify({ source: "check" }),
        outcome: "rejected",
        reason: "not_admin",
        automatedCheck: false,
    });

    it("takes the classification from the server", () => {
        const [checkLine, realLine, intruderLine] = [check, real, intruder].map((item) => describeLogEntry(item, jurors, agents, t));
        expect([checkLine.automated, realLine.automated, intruderLine.automated]).toEqual([true, false, false]);
    });

    it("hides checks by default and shows everything when asked", () => {
        const lines = [check, real, intruder].map((item) => describeLogEntry(item, jurors, agents, t));
        expect(visibleLogLines(lines, false).map((line) => line.id)).toEqual(["real", "intruder"]);
        expect(visibleLogLines(lines, true).map((line) => line.id)).toEqual(["check", "real", "intruder"]);
    });
});
