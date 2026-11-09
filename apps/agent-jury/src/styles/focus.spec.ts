import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// jsdom can't tell keyboard from mouse focus, so this guards the CSS contract; the keyboard
// behaviour itself is checked in the browser (docs/iteraciones/I1b.md, section 11).
const srcDir = join(import.meta.dirname, "..");
const globalCss = readFileSync(join(srcDir, "global.css"), "utf8");
const docketDir = join(srcDir, "components", "docket");

describe("focus ring", () => {
    it("shows the 3 px focus outline for keyboard focus only", () => {
        expect(globalCss).toMatch(/:focus-visible \{\s*outline: 3px solid var\(--focus\);\s*outline-offset: 3px;\s*\}/);
        expect(globalCss).toMatch(/:focus:not\(:focus-visible\) \{\s*outline: none;\s*\}/);
    });

    it("is never styled on plain :focus in docket components", () => {
        for (const file of readdirSync(docketDir).filter((name) => name.endsWith(".tsx"))) {
            const source = readFileSync(join(docketDir, file), "utf8");
            expect(source, file).not.toMatch(/(^|["\s])focus:/);
        }
    });
});
