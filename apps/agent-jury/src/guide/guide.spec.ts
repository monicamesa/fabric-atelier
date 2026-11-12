import { describe, expect, it } from "vitest";
import { guideHtml, renderMarkdown } from "./guide";

describe("guideHtml", () => {
    it("renders the English guide with headings, lists and tables", () => {
        const html = guideHtml("en");
        expect(html).not.toContain("<h1>");
        expect(html).toContain("<h2>How to play</h2>");
        expect(html).toContain("<ol>");
        expect(html).toContain("<table>");
    });

    it("renders the Spanish guide with the jury/judge vocabulary", () => {
        const html = guideHtml("es");
        expect(html).toContain("<h2>Cómo se juega</h2>");
        expect(html).toContain("Solo un admin");
        expect(html).not.toMatch(/\bfallo\b|\bfallado\b/i);
    });

    it("shows links to other repository files as plain text, so nothing in the app 404s", () => {
        for (const language of ["en", "es"] as const) {
            const html = guideHtml(language);
            expect(html).not.toContain("manual-test.md");
            expect(html).not.toContain("user-guide");
            expect(html).not.toMatch(/href="(?!https?:)/);
        }
    });
});

describe("renderMarkdown", () => {
    it("leaves out repo-only sentences", () => {
        expect(renderMarkdown("Rules.<!-- repo-only --> See [file](x.md).<!-- /repo-only -->")).toBe("<p>Rules.</p>\n");
    });

    it("keeps the label of a relative link and drops the link", () => {
        expect(renderMarkdown("See [the test script](manual-test.md).")).toBe('<p>See the test script.</p>\n');
    });

    it("opens external links in a new tab without leaking the opener", () => {
        const html = renderMarkdown("[Fabric](https://example.com/page)");
        expect(html).toContain('href="https://example.com/page"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
    });

    it("does not turn javascript: links into links", () => {
        expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("<a ");
    });

    it("escapes raw HTML", () => {
        const html = renderMarkdown("<script>alert(1)</script>");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });
});
