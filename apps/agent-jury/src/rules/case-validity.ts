// Single source of the case rules (AGENTS.md rule 18). I2 adds votes, `ruled` and `disputed`.

export type JurorRole = "expert" | "approver" | "admin";
export type CaseState = "under_review" | "ruled" | "disputed" | "dismissed";

export interface JurorRecord {
    email: string;
    role: JurorRole;
    active: boolean;
}

export interface CaseRecord {
    id: string;
    authorUserId: string;
    authorEmail: string;
}

export interface CaseDismissalRecord {
    case_id: string;
    dismissedByUserId: string;
    dismissedByEmail: string;
}

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function findActiveJuror(jurors: readonly JurorRecord[], email: string): JurorRecord | undefined {
    const target = normalizeEmail(email);
    return jurors.find((juror) => juror.active && normalizeEmail(juror.email) === target);
}

/** R7: only cases authored by an active juror count. */
export function isVerifiedCase(caseRecord: CaseRecord, jurors: readonly JurorRecord[]): boolean {
    return findActiveJuror(jurors, caseRecord.authorEmail) !== undefined;
}

/** R8: a dismissal counts when it comes from the case author or from an active admin. */
export function isValidDismissal(
    dismissal: CaseDismissalRecord,
    caseRecord: CaseRecord,
    jurors: readonly JurorRecord[],
): boolean {
    if (dismissal.case_id !== caseRecord.id) {
        return false;
    }
    if (dismissal.dismissedByUserId === caseRecord.authorUserId) {
        return true;
    }
    return findActiveJuror(jurors, dismissal.dismissedByEmail)?.role === "admin";
}

export function getCaseState(
    caseRecord: CaseRecord,
    dismissals: readonly CaseDismissalRecord[],
    jurors: readonly JurorRecord[],
): CaseState {
    const dismissed = dismissals.some((dismissal) => isValidDismissal(dismissal, caseRecord, jurors));
    return dismissed ? "dismissed" : "under_review";
}
