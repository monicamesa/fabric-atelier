// Deploys the app to the test workspace and leaves production as the active deployment.
//   node scripts/deploy-test.mjs [--set-secrets | --secrets-only]
// 1. `rayfin up --workspace-id <WORKSPACE_ID_AGENT_JURY_TEST>` (records the test deployment, rewrites rayfin/.env)
// 2. --set-secrets: sets APP_SQL_SERVER / APP_SQL_DATABASE (and HEARING_WORKSPACE_ID / HEARING_NOTEBOOK_ID when the
//    test notebook exists) on the test item from the *_TEST values
// 3. copies rayfin/.env to rayfin/.env.test (git-ignored), used by the deployed checks
// 4. `rayfin up switch --workspace-id <WORKSPACE_ID_AGENT_JURY>` makes production active again
// 5. restores rayfin/rayfin.yml (rayfin up adds the app URL to allowedRedirectUris)
// Ids come from .private/values.env and are never printed.
import { copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { appRoot, loadPrivateValues } from "./lib/deployment-target.mjs";

const values = loadPrivateValues();
const testWorkspace = values.WORKSPACE_ID_AGENT_JURY_TEST;
const productionWorkspace = values.WORKSPACE_ID_AGENT_JURY;
if (!testWorkspace || !productionWorkspace) {
    throw new Error("WORKSPACE_ID_AGENT_JURY_TEST and WORKSPACE_ID_AGENT_JURY are needed in .private/values.env.");
}
const secrets = [testWorkspace, productionWorkspace, values.APP_SQL_SERVER_AGENT_JURY_TEST, values.APP_SQL_DATABASE_AGENT_JURY_TEST].filter(Boolean);
const mask = (text) => secrets.reduce((out, secret) => out.split(secret).join("<id>"), text).replace(/https:\/\/\S+/g, "<url>");

function run(args, { input, quiet = false } = {}) {
    const result = spawnSync("npx", ["rayfin", ...args], { cwd: appRoot, encoding: "utf8", shell: true, input });
    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter((line) => /\[rayfin\]|deployed|✅|❌|rror|switch|ctive/i.test(line));
    if (!quiet) for (const line of lines) console.log(mask(line));
    if (result.status !== 0) throw new Error(`rayfin ${args[0]} ${args[1] ?? ""} failed (exit ${result.status}).`);
}

try {
    if (process.argv.includes("--secrets-only")) {
        run(["up", "switch", "--workspace-id", testWorkspace]);
    } else {
        console.log("Deploying to the test workspace…");
        run(["up", "--workspace-id", testWorkspace, "--yes"]);
    }
    if (process.argv.includes("--set-secrets") || process.argv.includes("--secrets-only")) {
        for (const [name, key] of [
            ["APP_SQL_SERVER", "APP_SQL_SERVER_AGENT_JURY_TEST"],
            ["APP_SQL_DATABASE", "APP_SQL_DATABASE_AGENT_JURY_TEST"],
            ["HEARING_WORKSPACE_ID", "WORKSPACE_ID_AGENT_JURY_TEST"],
            ["HEARING_NOTEBOOK_ID", "NOTEBOOK_ID_EVALUATE_AGENT_TEST"],
        ]) {
            if (!values[key]) throw new Error(`${key} is missing; run: node scripts/find-app-sql-database.mjs --target=test`);
            run(["secret", "set", name, "--stdin"], { input: values[key], quiet: true });
            console.log(`Set ${name} on the test item.`);
        }
    }
    copyFileSync(resolve(appRoot, "rayfin", ".env"), resolve(appRoot, "rayfin", ".env.test"));
    console.log("Wrote rayfin/.env.test.");
} finally {
    run(["up", "switch", "--workspace-id", productionWorkspace]);
    spawnSync("git", ["restore", "rayfin/rayfin.yml"], { cwd: appRoot, shell: true });
    console.log("Production is the active deployment again.");
}
process.exit(0);
