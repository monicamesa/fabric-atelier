import { beforeAll, describe, expect, it } from "vitest";
import type { AdminLogEntry } from "../../../rayfin/functions/src/clerk-actions";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { i18n, initI18n } from "@/i18n/i18n";
import { describeLogEntry } from "./log-entry";

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

    it("copes with unknown actions, broken payloads and old rows without a reason", () => {
        const line = describeLogEntry(entry({ action: "probe", payload: "not json", outcome: "rejected", reason: "" }), jurors, agents, t);
        expect(line.text).toBe("Rejected: dario.admin sent a request the office doesn't know (could not be applied)");
    });
});
