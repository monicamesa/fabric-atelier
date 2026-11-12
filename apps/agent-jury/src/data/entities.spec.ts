import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads the entity sources instead of importing them: the test runner does not compile TC39 decorators.
const dataDir = join(import.meta.dirname, "..", "..", "rayfin", "data");
const entityFiles = readdirSync(dataDir).filter((name) => name.endsWith(".ts") && name !== "schema.ts" && !name.endsWith(".spec.ts"));
const sources = Object.fromEntries(entityFiles.map((name) => [name, readFileSync(join(dataDir, name), "utf8")]));

const INSERT_ONLY = ["Case.ts", "Testimony.ts", "CaseDismissal.ts", "Vote.ts", "VerdictReview.ts"];
const READ_ONLY = ["Juror.ts", "Agent.ts", "Hearing.ts", "HearingCase.ts", "HearingEvent.ts", "Verdict.ts"];

describe("entity definitions", () => {
    it("cover the I1a–I3a entities", () => {
        expect(entityFiles.sort()).toEqual([
            "AdminRequest.ts",
            "AdminRequestResult.ts",
            "Agent.ts",
            "Case.ts",
            "CaseDismissal.ts",
            "Hearing.ts",
            "HearingCase.ts",
            "HearingEvent.ts",
            "Juror.ts",
            "Testimony.ts",
            "UserFlag.ts",
            "Verdict.ts",
            "VerdictReview.ts",
            "Vote.ts",
        ]);
    });

    it("AdminRequestResult is written only by the admin Function and readable only by the requester", () => {
        const source = sources["AdminRequestResult.ts"];
        const actions = [...source.matchAll(/@authenticated\('([^']+)'/g)].map((match) => match[1]);
        expect(actions).toEqual(["read"]);
        expect(source).toMatch(/claims\.email\.eq\(item\.requesterEmail\)/);
        expect(source).toMatch(/@uuid\(\{ unique: true \}\) requestId/);
        expect(source).not.toMatch(/@(anonymous|role)\(/);
    });

    it("AdminRequest is insert-only and visible only to its author", () => {
        const source = sources["AdminRequest.ts"];
        const actions = [...source.matchAll(/@authenticated\('([^']+)'/g)].map((match) => match[1]);
        expect(actions.sort()).toEqual(["create", "read"]);
        expect(source.match(/claims\.email\.eq\(item\.requesterEmail\)/g)).toHaveLength(2);
        expect(source).not.toMatch(/@(anonymous|role)\(/);
    });

    it("UserFlag is insert-only and visible only to its owner, with no email or name", () => {
        const source = sources["UserFlag.ts"];
        const actions = [...source.matchAll(/@authenticated\('([^']+)'/g)].map((match) => match[1]);
        expect(actions.sort()).toEqual(["create", "read"]);
        expect(source.match(/claims\.sub\.eq\(item\.userId\)/g)).toHaveLength(2);
        expect(source).not.toMatch(/@(anonymous|role|email)\(/);
        expect(source).not.toMatch(/@\w+\([^)]*\)\s+\w*(email|name)!/i);
    });

    it("VerdictReview needs both the subject and the email of the reviewer to create, and can carry a seed marker", () => {
        const source = sources["VerdictReview.ts"];
        expect(source).toMatch(/claims\.sub\.eq\(item\.reviewerUserId\)\.and\(claims\.email\.eq\(item\.reviewerEmail\)\)/);
        expect(source).toMatch(/@text\(\{ max: 20, optional: true \}\) source\?/);
        expect(source).toMatch(/@uuid\(\) verdict_id/);
    });

    it("Hearing records the critic-prompt version as optional text", () => {
        expect(sources["Hearing.ts"]).toMatch(/@text\(\{ max: 64, optional: true \}\) criticPromptVersion\?/);
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
