import { describe, expect, it } from "vitest";
import {
    findActiveJuror,
    getCaseState,
    isValidDismissal,
    isVerifiedCase,
    type CaseDismissalRecord,
    type CaseRecord,
    type JurorRecord,
} from "./case-validity";

const jurors: JurorRecord[] = [
    { email: "ana.expert@example.com", role: "expert", active: true },
    { email: "Bruno.Approver@example.com", role: "approver", active: true },
    { email: "carla.admin@example.com", role: "admin", active: true },
    { email: "dario.former@example.com", role: "admin", active: false },
];

const caseByJuror: CaseRecord = { id: "case-1", authorUserId: "sub-ana", authorEmail: "ana.expert@example.com" };
const caseByOutsider: CaseRecord = { id: "case-2", authorUserId: "sub-eva", authorEmail: "eva.outsider@example.com" };

function dismissal(overrides: Partial<CaseDismissalRecord>): CaseDismissalRecord {
    return { case_id: "case-1", dismissedByUserId: "sub-other", dismissedByEmail: "other@example.com", ...overrides };
}

describe("findActiveJuror", () => {
    it("matches emails ignoring case and surrounding spaces", () => {
        expect(findActiveJuror(jurors, "  bruno.approver@EXAMPLE.com ")?.role).toBe("approver");
    });

    it("ignores inactive jurors", () => {
        expect(findActiveJuror(jurors, "dario.former@example.com")).toBeUndefined();
    });
});

describe("isVerifiedCase (R7)", () => {
    it("counts a case authored by an active juror", () => {
        expect(isVerifiedCase(caseByJuror, jurors)).toBe(true);
    });

    it("marks a case by someone who is not a juror as unverified", () => {
        expect(isVerifiedCase(caseByOutsider, jurors)).toBe(false);
    });

    it("marks a case by an inactive juror as unverified", () => {
        const caseByFormer: CaseRecord = { id: "c", authorUserId: "s", authorEmail: "dario.former@example.com" };
        expect(isVerifiedCase(caseByFormer, jurors)).toBe(false);
    });
});

describe("isValidDismissal (R8)", () => {
    it("accepts a dismissal from the case author", () => {
        expect(isValidDismissal(dismissal({ dismissedByUserId: "sub-ana" }), caseByJuror, jurors)).toBe(true);
    });

    it("accepts a dismissal from an active admin", () => {
        expect(isValidDismissal(dismissal({ dismissedByEmail: "carla.admin@example.com" }), caseByJuror, jurors)).toBe(true);
    });

    it("ignores a dismissal from an inactive admin", () => {
        expect(isValidDismissal(dismissal({ dismissedByEmail: "dario.former@example.com" }), caseByJuror, jurors)).toBe(false);
    });

    it("ignores a dismissal from another juror who is not an admin", () => {
        expect(isValidDismissal(dismissal({ dismissedByEmail: "bruno.approver@example.com" }), caseByJuror, jurors)).toBe(false);
    });

    it("ignores a dismissal that belongs to another case", () => {
        expect(isValidDismissal(dismissal({ case_id: "case-2", dismissedByUserId: "sub-ana" }), caseByJuror, jurors)).toBe(false);
    });

    it("lets the author dismiss an unverified case", () => {
        const own = dismissal({ case_id: "case-2", dismissedByUserId: "sub-eva" });
        expect(isValidDismissal(own, caseByOutsider, jurors)).toBe(true);
    });
});

describe("getCaseState", () => {
    it("is under_review without dismissals", () => {
        expect(getCaseState(caseByJuror, [], jurors)).toBe("under_review");
    });

    it("is dismissed when at least one dismissal is valid", () => {
        const dismissals = [dismissal({}), dismissal({ dismissedByUserId: "sub-ana" })];
        expect(getCaseState(caseByJuror, dismissals, jurors)).toBe("dismissed");
    });

    it("stays under_review when every dismissal is invalid", () => {
        expect(getCaseState(caseByJuror, [dismissal({})], jurors)).toBe("under_review");
    });
});
