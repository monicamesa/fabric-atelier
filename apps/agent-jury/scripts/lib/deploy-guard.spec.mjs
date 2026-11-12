import { describe, expect, it } from "vitest";
import { assertDeployableHead, deployBlockers } from "./deploy-guard.mjs";

const git = (answers) => (args) => {
    const key = args.join(" ");
    const answer = answers[key];
    if (!answer) throw new Error(`unexpected git ${key}`);
    return { status: 0, stderr: "", ...answer };
};
const SHA = "a".repeat(40);
const clean = { "status --porcelain": { stdout: "" }, "fetch origin main --quiet": { stdout: "" }, "rev-parse HEAD": { stdout: SHA }, "rev-parse origin/main": { stdout: SHA } };

describe("deploy guard", () => {
    it("allows a clean tree whose HEAD is origin/main", () => {
        expect(deployBlockers(git(clean))).toEqual([]);
        expect(() => assertDeployableHead("/x", git(clean))).not.toThrow();
    });

    it("refuses a dirty tree (modified, staged or untracked files)", () => {
        const blockers = deployBlockers(git({ ...clean, "status --porcelain": { stdout: " M apps/agent-jury/src/App.tsx\n?? new-file.ts" } }));
        expect(blockers.join()).toMatch(/not clean/);
    });

    it("refuses when HEAD is not origin/main (unpushed commits, or another branch)", () => {
        const blockers = deployBlockers(git({ ...clean, "rev-parse HEAD": { stdout: "b".repeat(40) } }));
        expect(blockers.join()).toMatch(/not origin\/main/);
        expect(() => assertDeployableHead("/x", git({ ...clean, "rev-parse HEAD": { stdout: "b".repeat(40) } }))).toThrow(/Order: tests, commit, push, deploy/);
    });

    it("reports both problems at once", () => {
        const blockers = deployBlockers(git({ ...clean, "status --porcelain": { stdout: "M x" }, "rev-parse HEAD": { stdout: "b".repeat(40) } }));
        expect(blockers).toHaveLength(2);
    });

    it("refuses when origin cannot be read, instead of assuming it is pushed", () => {
        const blockers = deployBlockers(git({ ...clean, "fetch origin main --quiet": { status: 128, stdout: "" } }));
        expect(blockers.join()).toMatch(/Could not read origin\/main/);
    });

    it("refuses when git status itself fails", () => {
        expect(deployBlockers(git({ ...clean, "status --porcelain": { status: 128, stdout: "" } })).join()).toMatch(/git status failed/);
    });
});
