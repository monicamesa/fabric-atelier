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
    /** Sent by the deployed checks (scripts/i1a-checks.mjs, i1b-checks.mjs); hidden by default. */
    automated: boolean;
}

/** Payload field the deployed check scripts add to every AdminRequest they create. */
export const CHECK_SOURCE = "check";

// Every request before this moment came from the deployed checks of I1a and I1b, sent before the
// marker existed (audited 2026-11-09). Later deployments have no rows before it.
export const UNMARKED_CHECKS_BEFORE = "2026-11-09T15:12:00.000Z";

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

// Rows written before AdminRequestResult.reason existed (I1a) only have the server detail.
const LEGACY_REASONS: [RegExp, string][] = [
    [/not an active admin/i, "not_admin"],
    [/expired/i, "expired"],
    [/unknown action/i, "unknown_action"],
];

function reasonOf(entry: AdminLogEntry): string {
    if (KNOWN_REASONS.includes(entry.reason)) return entry.reason;
    if (entry.reason) return "other";
    return LEGACY_REASONS.find(([pattern]) => pattern.test(entry.detail))?.[1] ?? "other";
}

/**
 * Whether an entry was sent by the automated checks. Only requests from an active admin qualify,
 * so a non-admin can't hide their own rejected attempts by adding the marker.
 */
export function isAutomatedCheck(entry: AdminLogEntry, jurors: JurorRow[]): boolean {
    const requester = jurors.find((juror) => juror.email.toLowerCase() === entry.requesterEmail.toLowerCase());
    if (!requester?.active || requester.role !== "admin") return false;
    return parsePayload(entry.payload).source === CHECK_SOURCE || Date.parse(entry.processedAt) < Date.parse(UNMARKED_CHECKS_BEFORE);
}

export function visibleLogLines(lines: LogLine[], showChecks: boolean): LogLine[] {
    return showChecks ? lines : lines.filter((line) => !line.automated);
}

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
        case "probe":
            key = entry.action;
            break;
        default:
            key = "unknown";
    }

    const rejected = entry.outcome === "rejected";
    const sentence = t(`clerk.log.${rejected ? "attempt" : "entry"}.${key}`, { who, target, role: roleLabel });
    const reason = t(`clerk.log.reason.${reasonOf(entry)}`);
    return {
        id: entry.requestId,
        processedAt: entry.processedAt,
        who,
        text: rejected ? t("clerk.log.rejectedLine", { sentence, reason }) : sentence,
        rejected,
        automated: isAutomatedCheck(entry, jurors),
    };
}
