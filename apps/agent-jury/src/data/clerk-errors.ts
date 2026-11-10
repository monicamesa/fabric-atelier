import { ClerkActionError } from "./clerk.service";
import { NotSignedInError } from "./session-author";

/** i18n keys under `clerk.errors`. */
export type ClerkErrorKey =
    | "onlyAdmins"
    | "alreadyApplied"
    | "tryAgain"
    | "selfProtection"
    | "jurorExists"
    | "agentExists"
    | "invalid"
    | "notFound"
    | "notSignedIn"
    | "limitExceeded"
    | "noCases"
    | "hearingInProgress"
    | "cooldown"
    | "fabricError"
    | "unexpected";

export interface ClerkErrorView {
    key: ClerkErrorKey;
    /** Shown only inside "Technical details". */
    technicalDetails?: string;
}

/** Maps any failure of a clerk action to a plain-language message key. */
export function describeClerkError(error: unknown): ClerkErrorView {
    if (error instanceof NotSignedInError) {
        return { key: "notSignedIn" };
    }
    if (!(error instanceof ClerkActionError)) {
        return { key: "unexpected", technicalDetails: error instanceof Error ? error.message : String(error) };
    }
    const { result, technicalDetails } = error;
    if (!result) {
        return { key: "tryAgain", technicalDetails };
    }
    switch (result.reason) {
        case "expired":
        case "unknown_request":
            return { key: "tryAgain", technicalDetails };
        case "self_protection":
            return { key: "selfProtection", technicalDetails };
        case "already_exists":
            return { key: error.action === "registerAgent" ? "agentExists" : "jurorExists", technicalDetails };
        case "invalid_payload":
            return { key: "invalid", technicalDetails };
        case "not_found":
            return { key: "notFound", technicalDetails };
        case "limit_exceeded":
            return { key: "limitExceeded", technicalDetails };
        case "no_cases":
            return { key: "noCases", technicalDetails };
        case "hearing_in_progress":
            return { key: "hearingInProgress", technicalDetails };
        case "cooldown":
            return { key: "cooldown", technicalDetails };
        case "fabric_error":
            return { key: "fabricError", technicalDetails };
    }
    switch (result.code) {
        case 403:
            return { key: "onlyAdmins", technicalDetails };
        case 409:
            return { key: "alreadyApplied", technicalDetails };
        default:
            return { key: "unexpected", technicalDetails };
    }
}
