// Uploads fabric/notebooks/evaluate_agent.py as the evaluate_agent notebook of one environment.
//   node scripts/deploy-notebook.mjs [--target=production --allow-production]   (default: the test workspace)
// Each environment has its own notebook and Lakehouse (jury_lh), and each writes only to its own app database.
// Ids come from .private/values.env and are never printed. The notebook source must pass notebook-sql-policy first.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { appRoot, loadPrivateValues } from "./lib/deployment-target.mjs";
import { checkNotebookSql } from "./notebook-sql-policy.mjs";

const production = process.argv.includes("--target=production");
if (production && !process.argv.includes("--allow-production")) {
    throw new Error("Production needs --target=production --allow-production.");
}
const suffix = production ? "" : "_TEST";
const values = loadPrivateValues();
const workspaceId = values[production ? "WORKSPACE_ID_AGENT_JURY" : "WORKSPACE_ID_AGENT_JURY_TEST"];
const notebookId = values[`NOTEBOOK_ID_EVALUATE_AGENT${suffix}`];
const lakehouseId = values[`LAKEHOUSE_ID_JURY_LH${suffix}`];
if (!workspaceId || !notebookId || !lakehouseId) {
    throw new Error(`Missing workspace, NOTEBOOK_ID_EVALUATE_AGENT${suffix} or LAKEHOUSE_ID_JURY_LH${suffix} in .private/values.env.`);
}

const source = readFileSync(resolve(appRoot, "fabric", "notebooks", "evaluate_agent.py"), "utf8");
const violations = checkNotebookSql(source);
if (violations.length > 0) {
    throw new Error(`evaluate_agent.py breaks the SQL policy: ${violations.map((v) => v.rule).join("; ")}`);
}

const titles = [...source.matchAll(/^# %%\s*(.*)$/gm)].map((match) => match[1].trim());
const cells = source.split(/^# %%.*$/m).slice(1).map((cell) => cell.replace(/^\r?\n/, ""));
const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    cells: cells.map((cell, index) => ({
        cell_type: "code",
        source: cell.replace(/\s+$/, "").split(/\r?\n/).map((line, k, all) => (k < all.length - 1 ? `${line}\n` : line)),
        execution_count: null,
        outputs: [],
        metadata: titles[index] === "parameters" ? { tags: ["parameters"] } : {},
    })),
    metadata: {
        kernel_info: { name: "jupyter", jupyter_kernel_name: "python3.11" },
        kernelspec: { name: "jupyter", display_name: "Jupyter" },
        language_info: { name: "python" },
        microsoft: { language: "python", language_group: "jupyter_python" },
        dependencies: {
            lakehouse: { default_lakehouse: lakehouseId, default_lakehouse_name: "jury_lh", default_lakehouse_workspace_id: workspaceId, known_lakehouses: [{ id: lakehouseId }] },
        },
    },
};

const token = execFileSync(
    process.platform === "win32" ? "az.cmd" : "az",
    ["account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"],
    { encoding: "utf8", shell: process.platform === "win32" },
).trim();
const body = {
    definition: { format: "ipynb", parts: [{ path: "notebook-content.ipynb", payload: Buffer.from(JSON.stringify(notebook), "utf8").toString("base64"), payloadType: "InlineBase64" }] },
};
const response = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/notebooks/${notebookId}/updateDefinition`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
});
if (response.status === 202) {
    const location = response.headers.get("location");
    for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((done) => setTimeout(done, 5000));
        const state = await (await fetch(location, { headers: { Authorization: `Bearer ${token}` } })).json().catch(() => ({}));
        if (state.status === "Succeeded") break;
        if (state.status === "Failed") throw new Error("Fabric failed to update the notebook.");
    }
} else if (response.status !== 200) {
    throw new Error(`Fabric answered ${response.status} when updating the notebook.`);
}
console.log(`evaluate_agent updated in the ${production ? "production" : "test"} workspace.`);
process.exit(0);
