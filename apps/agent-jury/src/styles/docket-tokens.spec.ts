import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Keeps the CSS tokens identical to the table in section 2 of the design guide.
const root = join(import.meta.dirname, "..", "..");
const guide = readFileSync(join(root, "docs", "design", "design-guide.md"), "utf8");
const css = readFileSync(join(import.meta.dirname, "docket-tokens.css"), "utf8");

function guideTokens(): Record<string, { light: string; dark: string }> {
    const tokens: Record<string, { light: string; dark: string }> = {};
    for (const match of guide.matchAll(/^\| `(--[a-z-]+)` \| `(#[0-9A-F]{6})` \| `(#[0-9A-F]{6})`/gm)) {
        tokens[match[1]] = { light: match[2], dark: match[3] };
    }
    return tokens;
}

function cssBlock(selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`);
    const body = css.slice(start, css.indexOf("}", start));
    return Object.fromEntries([...body.matchAll(/(--[a-z-]+):\s*(#[0-9A-F]{6})/g)].map((match) => [match[1], match[2]]));
}

describe("design tokens", () => {
    const tokens = guideTokens();
    const light = cssBlock(":root");
    const dark = cssBlock('[data-theme="dark"]');

    it("read every colour token from the guide", () => {
        expect(Object.keys(tokens)).toHaveLength(21);
    });

    it.each(Object.keys(guideTokens()))("%s matches the guide in light and dark", (token) => {
        expect(light[token], `${token} light`).toBe(tokens[token].light);
        expect(dark[token], `${token} dark`).toBe(tokens[token].dark);
    });
});
