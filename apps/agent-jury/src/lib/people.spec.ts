import { describe, expect, it } from "vitest";
import { avatarTone, emailLocalPart, initials, jurorLabel, shortId } from "./people";

describe("people helpers", () => {
    it("uses the display name when there is one", () => {
        expect(jurorLabel({ email: "carla.approver@example.com", displayName: "Carla P." })).toBe("Carla P.");
    });

    it("falls back to the part of the email before the @", () => {
        expect(jurorLabel({ email: "carla.approver@example.com", displayName: "  " })).toBe("carla.approver");
        expect(jurorLabel({ email: "carla.approver@example.com", displayName: null })).toBe("carla.approver");
        expect(emailLocalPart("no-at-sign")).toBe("no-at-sign");
    });

    it("builds two initials from words or email parts", () => {
        expect(initials("Carla P.")).toBe("CP");
        expect(initials("carla.approver")).toBe("CA");
        expect(initials("dario")).toBe("DA");
    });

    it("shortens an id to its first and last four characters", () => {
        expect(shortId("00000000-0000-4000-8000-000000000041")).toBe("0000…0041");
        expect(shortId("abc")).toBe("abc");
    });

    it("gives each id a stable avatar tone, whatever the casing", () => {
        const id = "00000000-0000-4000-8000-0000000000AB";
        expect(avatarTone(id, 4)).toBe(avatarTone(id.toLowerCase(), 4));
        const tones = new Set(["11", "12", "13", "14", "15", "16"].map((end) => avatarTone(`00000000-0000-4000-8000-0000000000${end}`, 4)));
        expect(tones.size).toBeGreaterThan(1);
        expect([...tones].every((tone) => tone >= 0 && tone < 4)).toBe(true);
    });
});
