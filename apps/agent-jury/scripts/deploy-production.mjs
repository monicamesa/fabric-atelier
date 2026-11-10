// Deploys the app to the PRODUCTION workspace (the active deployment) and sets its secrets.
//   node scripts/deploy-production.mjs --allow-production [--set-secrets]
// 1. `rayfin up` against the active deployment (production), then `git restore rayfin/rayfin.yml`
// 2. --set-secrets: APP_SQL_SERVER / APP_SQL_DATABASE / HEARING_WORKSPACE_ID / HEARING_NOTEBOOK_ID from .private/values.env
// Ids come from .private/values.env and are never printed.
import { spawnSync } from "node:child_process";
import { appRoot, loadPrivateValues } from "./lib/deployment-target.mjs";

if (!process.argv.includes("--allow-production")) {
    throw new Error("Production needs --allow-production.");
}
const values = loadPrivateValues();
const production = values.WORKSPACE_ID_AGENT_JURY;
if (!production) throw new Error("WORKSPACE_ID_AGENT_JURY is needed in .private/values.env.");
const secrets = [production, values.APP_SQL_SERVER_AGENT_JURY, values.APP_SQL_DATABASE_AGENT_JURY, values.NOTEBOOK_ID_EVALUATE_AGENT].filter(Boolean);
const mask = (text) => secrets.reduce((out, secret) => out.split(secret).join("<id>"), text).replace(/https:\/\/\S+/g, "<url>");

function run(args, { input, quiet = false } = {}) {
    const result = spawnSync("npx", ["rayfin", ...args], { cwd: appRoot, encoding: "utf8", shell: true, input });
    const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter((line) => /\[rayfin\]|deployed|✅|❌|rror|ctive/i.test(line));
    if (!quiet) for (const line of lines) console.log(mask(line));
    if (result.status !== 0) throw new Error(`rayfin ${args[0]} ${args[1] ?? ""} failed (exit ${result.status}).`);
}

try {
    console.log("Deploying to the production workspace…");
    run(["up", "--workspace-id", production, "--yes"]);
    if (process.argv.includes("--set-secrets")) {
        for (const [name, key] of [
            ["APP_SQL_SERVER", "APP_SQL_SERVER_AGENT_JURY"],
            ["APP_SQL_DATABASE", "APP_SQL_DATABASE_AGENT_JURY"],
            ["HEARING_WORKSPACE_ID", "WORKSPACE_ID_AGENT_JURY"],
            ["HEARING_NOTEBOOK_ID", "NOTEBOOK_ID_EVALUATE_AGENT"],
        ]) {
            if (!values[key]) throw new Error(`${key} is missing in .private/values.env.`);
            run(["secret", "set", name, "--stdin"], { input: values[key], quiet: true });
            console.log(`Set ${name} on the production item.`);
        }
    }
} finally {
    spawnSync("git", ["restore", "rayfin/rayfin.yml"], { cwd: appRoot, shell: true });
    console.log("rayfin/rayfin.yml restored.");
}
process.exit(0);
