// Looks up the app's SQL database coordinates with the Fabric REST API and stores them in
// .private/values.env (APP_SQL_SERVER_AGENT_JURY, APP_SQL_DATABASE_AGENT_JURY) without printing them.
//   node scripts/find-app-sql-database.mjs
import { appendFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const valuesPath = resolve(import.meta.dirname, "..", "..", "..", ".private", "values.env");
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const values = Object.fromEntries(
    readFileSync(valuesPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map((match) => [match[1], match[2]]),
);
const { TENANT_ID: tenantId, WORKSPACE_ID_AGENT_JURY: workspaceId } = values;
if (!GUID.test(tenantId ?? "") || !GUID.test(workspaceId ?? "")) {
    throw new Error("TENANT_ID or WORKSPACE_ID_AGENT_JURY is missing in .private/values.env.");
}

const token = spawnSync(
    "az",
    ["account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--tenant", tenantId, "--query", "accessToken", "-o", "tsv"],
    { encoding: "utf8", shell: process.platform === "win32" },
).stdout.trim();
if (!token) {
    throw new Error("az could not issue a Fabric token. Run: az login --tenant <TENANT_ID>");
}

async function fabric(path) {
    const response = await fetch(`https://api.fabric.microsoft.com/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
        throw new Error(`Fabric API ${path.split("?")[0].replace(GUID, "<id>")} returned ${response.status}`);
    }
    return response.json();
}

const items = (await fabric(`/workspaces/${workspaceId}/items?type=SQLDatabase`)).value ?? [];
console.log(`SQL databases in the workspace: ${items.length}`);
for (const item of items) {
    console.log(`  - ${item.displayName}`);
}
if (items.length !== 1) {
    throw new Error("Expected exactly one SQL database in the workspace; pick it by hand.");
}

const database = await fabric(`/workspaces/${workspaceId}/sqlDatabases/${items[0].id}`);
const server = database.properties?.serverFqdn;
const name = database.properties?.databaseName;
if (!server || !name) {
    throw new Error("The SQL database has no serverFqdn or databaseName yet.");
}

const missing = [
    ["APP_SQL_SERVER_AGENT_JURY", server],
    ["APP_SQL_DATABASE_AGENT_JURY", name],
].filter(([key]) => !(key in values));
for (const [key, value] of missing) {
    appendFileSync(valuesPath, `${key}=${value}\n`);
}
console.log(missing.length ? `Stored ${missing.map(([key]) => key).join(", ")} in .private/values.env.` : "Values already present; nothing changed.");
