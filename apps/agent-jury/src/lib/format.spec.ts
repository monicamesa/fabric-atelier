import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatLogDay, formatNumber, formatRelativeDay } from "./format";

// Noon UTC keeps the calendar day stable in any test time zone.
const sample = new Date(Date.UTC(2026, 10, 9, 12, 0, 0));

describe("format", () => {
    it("formats dates with en-GB and es-ES conventions", () => {
        expect(formatDate(sample, "en")).toBe("9 Nov 2026");
        expect(formatDate(sample, "es")).toBe("9 nov 2026");
    });

    it("accepts ISO strings as returned by the data API", () => {
        expect(formatDate("2026-11-09T12:00:00Z", "en")).toBe(formatDate(sample, "en"));
    });

    it("includes the time in formatDateTime", () => {
        expect(formatDateTime(sample, "en")).toMatch(/9 Nov 2026.*\d{2}:\d{2}/);
    });

    it("formats numbers with each language's separators", () => {
        expect(formatNumber(12345.6, "en")).toBe("12,345.6");
        expect(formatNumber(12345.6, "es")).toBe("12.345,6");
    });

    it("formats percentages", () => {
        expect(formatNumber(0.875, "en", { style: "percent", maximumFractionDigits: 1 })).toBe("87.5%");
        expect(formatNumber(0.875, "es", { style: "percent", maximumFractionDigits: 1 })).toBe("87,5\u00a0%");
    });

    it("shows the time for today's log entries and the day for older ones", () => {
        const sameDay = formatLogDay(sample, "en", new Date(sample.getTime() + 60_000));
        expect(sameDay.today).toBe(true);
        expect(sameDay.text).toMatch(/^\d{2}:\d{2}$/);
        const later = new Date(sample.getTime() + 3 * 86_400_000);
        expect(formatLogDay(sample, "en", later)).toEqual({ today: false, text: "9 Nov" });
        expect(formatLogDay(sample, "es", later)).toEqual({ today: false, text: "9 nov" });
    });

    it("says today, yesterday or days ago for the last week, then the date", () => {
        const day = 86_400_000;
        expect(formatRelativeDay(sample, "en", new Date(sample.getTime() + 60_000))).toBe("Today");
        expect(formatRelativeDay(sample, "es", new Date(sample.getTime() + day))).toBe("Ayer");
        expect(formatRelativeDay(sample, "en", new Date(sample.getTime() + 3 * day))).toBe("3 days ago");
        expect(formatRelativeDay(sample, "es", new Date(sample.getTime() + 3 * day))).toBe("Hace 3 días");
        expect(formatRelativeDay(sample, "en", new Date(sample.getTime() + 10 * day))).toBe("9 Nov");
    });
});
