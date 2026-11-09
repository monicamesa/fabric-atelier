// Runs a T-SQL file against the agent-jury app database as the signed-in Azure CLI user (the item owner).
//   node scripts/run-sql.mjs <file.sql> [--target=test] [--var Name=VALUES_KEY ...]
// Server and database come from .private/values.env (APP_SQL_SERVER_AGENT_JURY, APP_SQL_DATABASE_AGENT_JURY,
// or the *_TEST keys with --target=test).
// Each --var replaces $(Name) in the script with the value of VALUES_KEY from .private/values.env,
// so private values such as the admin email never appear in tracked files or on the command line.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import sql from "mssql";

const args = process.argv.slice(2);
const isTest = args.includes("--target=test");
const [file, ...rest] = args.filter((arg) => !arg.startsWith("--target="));
if (!file) {
    throw new Error("Usage: node scripts/run-sql.mjs <file.sql> [--var Name=VALUES_KEY ...]");
}

const valuesPath = resolve(import.meta.dirname, "..", "..", "..", ".private", "values.env");
const values = Object.fromEntries(
    readFileSync(valuesPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map((match) => [match[1], match[2]]),
);

let script = readFileSync(resolve(file), "utf8");
for (let index = 0; index < rest.length; index += 2) {
    const [name, key] = (rest[index] === "--var" ? rest[index + 1] ?? "" : "").split("=");
    const value = values[key];
    if (!/^[A-Za-z]\w*$/.test(name ?? "") || !value || /['\r\n]/.test(value)) {
        throw new Error(`Invalid --var ${rest[index + 1] ?? ""}: expected Name=VALUES_KEY with a value and no quotes.`);
    }
    script = script.replaceAll(`$(${name})`, value);
}
const unresolved = script.match(/\$\(\w+\)/);
if (unresolved) {
    throw new Error(`Unresolved SQLCMD variable ${unresolved[0]}; pass --var.`);
}

const suffix = isTest ? "_TEST" : "";
const serverFqdn = values[`APP_SQL_SERVER_AGENT_JURY${suffix}`];
const database = values[`APP_SQL_DATABASE_AGENT_JURY${suffix}`];
if (!serverFqdn || !database) {
    throw new Error(`APP_SQL_SERVER_AGENT_JURY${suffix} or APP_SQL_DATABASE_AGENT_JURY${suffix} missing; run scripts/find-app-sql-database.mjs${isTest ? " --target=test" : ""}.`);
}
// Fabric reports serverFqdn as "host,port".
const [server, port] = serverFqdn.split(",");

const token = execFileSync(
    process.platform === "win32" ? "az.cmd" : "az",
    ["account", "get-access-token", "--resource", "https://database.windows.net", "--query", "accessToken", "-o", "tsv"],
    { encoding: "utf8", shell: process.platform === "win32" },
).trim();

const pool = await new sql.ConnectionPool({
    server: server.trim(),
    port: Number(port ?? 1433),
    database,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: { type: "azure-active-directory-access-token", options: { token } },
}).connect();
try {
    const result = await pool.request().batch(script);
    for (const recordset of result.recordsets) {
        console.table(recordset);
    }
} finally {
    await pool.close();
}
