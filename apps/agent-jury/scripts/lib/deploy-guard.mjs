// Production deploys come only from a committed, clean working tree whose HEAD is already pushed (AGENTS.md,
// "Token and capacity discipline"). The chain is always: tests -> commit (hooks) -> push -> deploy.
import { spawnSync } from "node:child_process";

/** Runs a git command at the repository root and returns { status, stdout }. Injectable so the rules can be tested. */
export function runGit(args, cwd) {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    return { status: result.status ?? 1, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

/**
 * Returns a list of reasons the deploy must be refused (empty = fine):
 * - `git status --porcelain` is not empty (uncommitted, staged or untracked files),
 * - HEAD is not origin/main (not on main, not pushed, or behind).
 */
export function deployBlockers(git) {
    const blockers = [];
    const status = git(["status", "--porcelain"]);
    if (status.status !== 0) blockers.push("git status failed.");
    else if (status.stdout !== "") blockers.push("The working tree is not clean: commit (hooks run) before deploying.");

    const fetched = git(["fetch", "origin", "main", "--quiet"]);
    if (fetched.status !== 0) {
        blockers.push("Could not read origin/main (git fetch failed), so it is unknown whether HEAD is pushed.");
        return blockers;
    }
    const head = git(["rev-parse", "HEAD"]);
    const remote = git(["rev-parse", "origin/main"]);
    if (head.status !== 0 || remote.status !== 0) blockers.push("Could not resolve HEAD or origin/main.");
    else if (head.stdout !== remote.stdout) blockers.push("HEAD is not origin/main: push your commits to main first (and deploy from main).");
    return blockers;
}

/** Throws with every reason when the deploy is not allowed. */
export function assertDeployableHead(cwd, git = (args) => runGit(args, cwd)) {
    const blockers = deployBlockers(git);
    if (blockers.length > 0) {
        throw new Error(`Refusing to deploy to production:\n - ${blockers.join("\n - ")}\nOrder: tests, commit, push, deploy.`);
    }
}
