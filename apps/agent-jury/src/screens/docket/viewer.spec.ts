import { describe, expect, it } from "vitest";
import type { JurorRow } from "@/data/directory.service";
import { answerLetter, personName, personTeam, viewerFor } from "./viewer";

const jurors: JurorRow[] = [
    { id: "j1", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", team: "Sales", active: true },
    { id: "j2", email: "root.admin@example.com", displayName: null, role: "admin", team: null, active: true },
    { id: "j3", email: "old.juror@example.com", displayName: "Old J.", role: "approver", team: null, active: false },
];
const session = (email: string) => ({ isAuthenticated: true, user: { id: `sub-${email}`, email } });

describe("viewer", () => {
    it("lets only active jurors act (D2)", () => {
        expect(viewerFor(session("ANA.expert@example.com"), jurors)).toMatchObject({ canAct: true, isAdmin: false });
        expect(viewerFor(session("root.admin@example.com"), jurors)).toMatchObject({ canAct: true, isAdmin: true });
        expect(viewerFor(session("old.juror@example.com"), jurors)).toMatchObject({ canAct: false, juror: undefined });
        expect(viewerFor(session("visitor@example.com"), jurors).canAct).toBe(false);
        expect(viewerFor({ isAuthenticated: false }, jurors)).toEqual({ me: undefined, juror: undefined, canAct: false, isAdmin: false });
    });

    it("cannot act while the jury list is still loading", () => {
        expect(viewerFor(session("ana.expert@example.com"), undefined).canAct).toBe(false);
    });

    it("names people by display name, else by the email before the @", () => {
        expect(personName("ana.expert@example.com", jurors)).toBe("Ana E.");
        expect(personName("root.admin@example.com", jurors)).toBe("root.admin");
        expect(personName("visitor@example.com", jurors)).toBe("visitor");
        expect(personTeam("ANA.expert@example.com", jurors)).toBe("Sales");
        expect(personTeam("root.admin@example.com", jurors)).toBeUndefined();
    });

    it("letters answers in order", () => {
        expect([0, 1, 25, 26].map(answerLetter)).toEqual(["A", "B", "Z", "27"]);
    });
});
