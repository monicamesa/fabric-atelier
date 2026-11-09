// Runs the I1b post-deploy checks of clerkExecute's actions as the `rayfin login` user, who must be an active admin.
// Prints only pass/fail lines: never tokens, emails or identifiers.
//   node scripts/i1b-checks.mjs
// Leaves an inactive example juror (i1b.check@example.com) and a retired example agent: nothing is ever deleted.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";

const appRoot = resolve(import.meta.dirname, "..");
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECK_JUROR_EMAIL = "i1b.check@example.com";
const CHECK_AGENT = {
    name: "I1b check agent (example)",
    workspaceId: "00000000-0000-4000-8000-000000000051",
    itemId: "00000000-0000-4000-8000-000000000052",
};
const MISSING_ID = "00000000-0000-4000-8000-000000000059";

function readEnvFile(path) {
    const values = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return values;
}

const privateValues = readEnvFile(resolve(appRoot, "..", "..", ".private", "values.env"));
const rayfinEnv = readEnvFile(resolve(appRoot, "rayfin", ".env"));
const tenantId = privateValues.TENANT_ID;
const baseUrl = rayfinEnv.RAYFIN_PUBLIC_API_URL;
const publishableKey = rayfinEnv.RAYFIN_PUBLIC_PUBLISHABLE_KEY;
if (!GUID.test(tenantId ?? "") || !baseUrl?.startsWith("https://") || !publishableKey) {
    throw new Error("Missing TENANT_ID in .private/values.env or the deployment values in rayfin/.env.");
}

const results = [];
function record(id, description, passed, detail = "") {
    results.push({ id, passed });
    console.log(`${passed ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${description}${detail ? ` (${detail})` : ""}`);
}

const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });
const email = client.auth.getSession().user?.email;

async function clerk(action, payload) {
    try {
        const request = await client.data.AdminRequest.create({
            requesterEmail: email,
            action,
            // Marks the request as automated; the Clerk's office hides it by default.
            payload: JSON.stringify({ ...payload, source: "check" }),
            createdAt: new Date(),
        });
        return await client.functions.clerkExecute.invoke({ requestId: request.id });
    } catch (error) {
        return { code: 0, outcome: "rejected", reason: "transport", detail: String(error?.message ?? error).slice(0, 160) };
    }
}

function expect(id, description, result, codes, reason) {
    const passed = codes.includes(result.code) && (!reason || result.reason === reason);
    record(id, description, passed, `${result.code} ${result.reason}: ${result.detail}`);
    return passed;
}

async function jurorByEmail(address) {
    const rows = await client.data.Juror.select(["id", "email", "role", "active"]).where({ email: { eq: address } }).execute();
    return rows?.[0];
}

const me = await jurorByEmail(email);
record("B.0", "the signed-in user is an active admin juror", me?.role === "admin" && me.active === true);

// Jurors
expect("B.1", "swearInJuror adds an example juror (or finds it already there)",
    await clerk("swearInJuror", { email: CHECK_JUROR_EMAIL, displayName: "I1b check", team: "Checks", role: "expert" }), [200, 422]);
expect("B.2", "swearInJuror twice is rejected as already on the jury",
    await clerk("swearInJuror", { email: CHECK_JUROR_EMAIL, role: "expert" }), [422], "already_exists");
const checkJuror = await jurorByEmail(CHECK_JUROR_EMAIL);
record("B.3", "the example juror is readable with its display name", !!checkJuror);
if (checkJuror) {
    expect("B.4", "setJurorActive reinstates the example juror", await clerk("setJurorActive", { jurorId: checkJuror.id, active: true }), [200]);
    expect("B.5", "setJurorRole makes the example juror an approver", await clerk("setJurorRole", { jurorId: checkJuror.id, role: "approver" }), [200]);
    record("B.6", "the role change is visible", (await jurorByEmail(CHECK_JUROR_EMAIL))?.role === "approver");
    expect("B.7", "setJurorActive deactivates the example juror", await clerk("setJurorActive", { jurorId: checkJuror.id, active: false }), [200]);
    record("B.8", "the deactivation is visible", (await jurorByEmail(CHECK_JUROR_EMAIL))?.active === false);
}

// Self-protection
if (me) {
    expect("B.9", "an admin cannot remove their own admin role", await clerk("setJurorRole", { jurorId: me.id, role: "expert" }), [422], "self_protection");
    expect("B.10", "an admin cannot deactivate themselves", await clerk("setJurorActive", { jurorId: me.id, active: false }), [422], "self_protection");
    record("B.11", "the admin is still an active admin", (await jurorByEmail(email))?.role === "admin" && (await jurorByEmail(email))?.active === true);
}

// Agents
expect("B.12", "registerAgent adds an example agent (or finds it already there)", await clerk("registerAgent", CHECK_AGENT), [200, 422]);
expect("B.13", "registerAgent twice is rejected as already registered", await clerk("registerAgent", CHECK_AGENT), [422], "already_exists");
const [agent] = (await client.data.Agent.select(["id", "active"]).where({ itemId: { eq: CHECK_AGENT.itemId } }).execute()) ?? [];
if (agent) {
    expect("B.14", "setAgentActive retires the example agent", await clerk("setAgentActive", { agentId: agent.id, active: false }), [200]);
} else {
    record("B.14", "the example agent is readable", false);
}
expect("B.15", "an unknown agent id is rejected", await clerk("setAgentActive", { agentId: MISSING_ID, active: false }), [404], "not_found");

// Validation and the log
expect("B.16", "an invalid payload is rejected", await clerk("registerAgent", { name: "x", workspaceId: "nope", itemId: "nope" }), [400], "invalid_payload");
expect("B.17", "the old probe action no longer exists", await clerk("probe", {}), [403], "unknown_action");
const log = await clerk("readAdminLog", { limit: 50 });
expect("B.18", "readAdminLog returns the admin log", log, [200]);
const entries = log.log ?? [];
record("B.19", "the log includes rejected attempts with their reason", entries.some((entry) => entry.outcome === "rejected" && entry.reason === "self_protection"));
record("B.20", "successful log reads are not listed", !entries.some((entry) => entry.action === "readAdminLog" && entry.outcome === "done"));
if (checkJuror) {
    expect("B.21", "editJurorDetails updates the example juror's display name and team",
        await clerk("editJurorDetails", { jurorId: checkJuror.id, displayName: "I1b check", team: "Checks" }), [200]);
}
const marked = entries.filter((entry) => {
    try {
        return JSON.parse(entry.payload).source === "check";
    } catch {
        return false;
    }
});
record("B.22", "the log flags requests marked by the checks as automated", marked.length > 0 && marked.every((entry) => entry.automatedCheck === true), `${marked.length} marked`);

const failed = results.filter((result) => !result.passed).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
