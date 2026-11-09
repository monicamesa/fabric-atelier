import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads the entity sources instead of importing them: the test runner does not compile TC39 decorators.
const dataDir = join(import.meta.dirname, "..", "..", "rayfin", "data");
const entityFiles = readdirSync(dataDir).filter((name) => name.endsWith(".ts") && name !== "schema.ts" && !name.endsWith(".spec.ts"));
const sources = Object.fromEntries(entityFiles.map((name) => [name, readFileSync(join(dataDir, name), "utf8")]));

const INSERT_ONLY = ["Case.ts", "Testimony.ts", "CaseDismissal.ts"];
const READ_ONLY = ["Juror.ts", "Agent.ts"];

describe("entity definitions", () => {
    it("cover the I1a entities", () => {
        expect(entityFiles.sort()).toEqual(["AdminRequest.ts", "Agent.ts", "Case.ts", "CaseDismissal.ts", "Juror.ts", "Testimony.ts"]);
    });

    it("AdminRequest is insert-only and visible only to its author", () => {
        const source = sources["AdminRequest.ts"];
        const actions = [...source.matchAll(/@authenticated\('([^']+)'/g)].map((match) => match[1]);
        expect(actions.sort()).toEqual(["create", "read"]);
        expect(source.match(/claims\.email\.eq\(item\.requesterEmail\)/g)).toHaveLength(2);
        expect(source).not.toMatch(/@(anonymous|role)\(/);
    });

    it.each(entityFiles)("%s gives every text and email field an explicit max", (name) => {
        const decorators = sources[name].match(/@(text|email)\(([^)]*)\)/g) ?? [];
        expect(decorators.length).toBeGreaterThan(0);
        for (const decorator of decorators) {
            expect(decorator, `${name}: ${decorator}`).toMatch(/max:\s*\d+/);
        }
    });

    it.each(entityFiles)("%s declares foreign keys as @uuid(), as the CLI requires", (name) => {
        const foreignKeys = sources[name].match(/@\w+\([^)]*\)\s+\w+_id!/g) ?? [];
        for (const field of foreignKeys) {
            expect(field, `${name}: ${field}`).toMatch(/^@uuid\(\)/);
        }
    });

    it.each(INSERT_ONLY)("%s only allows read and create", (name) => {
        const actions = [...sources[name].matchAll(/@authenticated\('([^']+)'/g)].map((match) => match[1]);
        expect(actions.sort()).toEqual(["create", "read"]);
        expect(sources[name]).not.toMatch(/@(anonymous|role)\(/);
        expect(sources[name]).toMatch(/policy: \(claims, item\) => claims\.sub\.eq\(item\.\w+UserId\)/);
    });

    it.each(READ_ONLY)("%s only allows read to the client", (name) => {
        const actions = [...sources[name].matchAll(/@authenticated\('([^']+)'/g)].map((match) => match[1]);
        expect(actions).toEqual(["read"]);
        expect(sources[name]).not.toMatch(/@(anonymous|role)\(/);
    });
});
