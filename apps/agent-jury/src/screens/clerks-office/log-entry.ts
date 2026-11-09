import type { TFunction } from "i18next";
import type { AdminLogEntry } from "../../../rayfin/functions/src/clerk-actions";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { emailLocalPart, jurorLabel } from "@/lib/people";

export interface LogLine {
    id: string;
    processedAt: string;
    who: string;
    text: string;
    rejected: boolean;
}

function parsePayload(payload: string): Record<string, unknown> {
    try {
        const value: unknown = JSON.parse(payload);
        return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const sameId = (a: string, b: unknown) => typeof b === "string" && a.toLowerCase() === b.toLowerCase();

const KNOWN_REASONS = ["not_admin", "expired", "self_protection", "already_exists", "invalid_payload", "not_found", "unknown_action"];

/** Turns an admin log entry into one plain sentence. Emails are reduced to their local part. */
export function describeLogEntry(entry: AdminLogEntry, jurors: JurorRow[], agents: AgentRow[], t: TFunction): LogLine {
    const payload = parsePayload(entry.payload);
    const requester = jurors.find((juror) => juror.email.toLowerCase() === entry.requesterEmail.toLowerCase());
    const who = requester ? jurorLabel(requester) : emailLocalPart(entry.requesterEmail);
    const someone = t("clerk.log.someone");
    const jurorName = () => {
        const juror = jurors.find((row) => sameId(row.id, payload.jurorId));
        return juror ? jurorLabel(juror) : someone;
    };
    const agentName = () => text(payload.name) ?? agents.find((row) => sameId(row.id, payload.agentId))?.name ?? someone;
    const role = (value: unknown) => (typeof value === "string" && ["expert", "approver", "admin"].includes(value) ? t(`roles.${value}.label`) : "");

    let key: string;
    let target = "";
    let roleLabel = "";
    switch (entry.action) {
        case "swearInJuror": {
            key = "swearInJuror";
            const email = text(payload.email);
            target = text(payload.displayName) ?? (email ? emailLocalPart(email) : someone);
            roleLabel = role(payload.role);
            break;
        }
        case "setJurorRole":
            key = "setJurorRole";
            target = jurorName();
            roleLabel = role(payload.role);
            break;
        case "setJurorActive":
            key = payload.active === true ? "reinstateJuror" : "deactivateJuror";
            target = jurorName();
            break;
        case "registerAgent":
            key = "registerAgent";
            target = agentName();
            break;
        case "setAgentActive":
            key = payload.active === true ? "reinstateAgent" : "retireAgent";
            target = agentName();
            break;
        case "readAdminLog":
            key = "readAdminLog";
            break;
        default:
            key = "unknown";
    }

    const rejected = entry.outcome === "rejected";
    const sentence = t(`clerk.log.${rejected ? "attempt" : "entry"}.${key}`, { who, target, role: roleLabel });
    const reason = t(`clerk.log.reason.${KNOWN_REASONS.includes(entry.reason) ? entry.reason : "other"}`);
    return {
        id: entry.requestId,
        processedAt: entry.processedAt,
        who,
        text: rejected ? t("clerk.log.rejectedLine", { sentence, reason }) : sentence,
        rejected,
    };
}
