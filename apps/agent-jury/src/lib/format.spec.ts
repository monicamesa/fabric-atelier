import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatNumber } from "./format";

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
});
