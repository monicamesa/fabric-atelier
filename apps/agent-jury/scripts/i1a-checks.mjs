// Runs the I1a post-deploy checks against the deployed app as the `rayfin login` user.
// Prints only pass/fail lines: never tokens, emails or identifiers.
//   node scripts/i1a-checks.mjs [--only=removed,probe,r1] [--expect-admin]
// --expect-admin: the signed-in user is an active admin juror; without it, the user must not be one.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";

const appRoot = resolve(import.meta.dirname, "..");
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
const sections = new Set((onlyArg ? onlyArg.slice("--only=".length) : "removed,probe,r1").split(","));
const expectAdmin = process.argv.includes("--expect-admin");
// A seeded example admin: claiming its email must be rejected at the insert.
const OTHER_ADMIN_EMAIL = "dario.admin@example.com";

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

// Same delegated scope and token source as @microsoft/rayfin-local-dev's automatic sign-in.
async function getEntraToken() {
    const result = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
    return result.token;
}

const results = [];
function record(id, description, passed, detail = "") {
    results.push({ id, passed });
    console.log(`${passed ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${description}${detail ? ` (${detail})` : ""}`);
}

async function expectSuccess(id, description, action) {
    try {
        const value = await action();
        record(id, description, true);
        return value;
    } catch (error) {
        record(id, description, false, describeError(error));
        return undefined;
    }
}

async function expectRejection(id, description, action) {
    try {
        await action();
        record(id, description, false, "the operation was accepted");
    } catch (error) {
        record(id, description, true, describeError(error));
    }
}

function describeError(error) {
    const name = error?.name ?? "Error";
    const message = String(error?.message ?? error).replace(/\s+/g, " ").slice(0, 160);
    return `${name}: ${message}`;
}

const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: await getEntraToken() });
const session = client.auth.getSession();
const me = { id: session.user?.id, email: session.user?.email };
console.log(`Signed in: ${session.isAuthenticated ? "yes" : "no"}; session has email: ${me.email ? "yes" : "no"}`);

const anonymous = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await expectRejection("R1.0", "reading data without a session is rejected", () =>
    anonymous.data.Juror.select(["id"]).first(1).execute(),
);

// The S-A spike Functions must no longer exist.
if (sections.has("removed")) {
    await expectRejection("X.1", "whoAmI no longer responds", () =>
        client.functions.whoAmI.invoke({ expectedSub: "x", expectedEmail: "x" }),
    );
    await expectRejection("X.2", "spikeSqlJuror no longer responds", () => client.functions.spikeSqlJuror.invoke());
}

// Proof by insert: getDataClient() inside the Function must carry the caller's identity.
if (sections.has("probe")) {
    const own = await expectSuccess("P.1", "adminProbe runs for the caller's own email", () =>
        client.functions.adminProbe.invoke({ claimedEmail: me.email ?? "" }),
    );
    if (own) {
        record("P.2", "the insert with the caller's own email passes (getDataClient carries the identity)", own.stage !== "insert", own.stage === "insert" ? own.detail : "");
        record("P.3", "the author can read the request back", own.stage !== "read-back", own.stage === "read-back" ? own.detail : "");
        record(
            expectAdmin ? "P.4a" : "P.4b",
            expectAdmin ? "(a) an active admin is allowed" : "(b) a user who is not an admin is rejected",
            expectAdmin ? own.status === 200 && own.stage === "allowed" : own.status === 403 && own.stage === "admin-check",
            `status ${own.status}, stage ${own.stage}`,
        );
    }
    const forged = await expectSuccess("P.5", "adminProbe runs when claiming another user's email", () =>
        client.functions.adminProbe.invoke({ claimedEmail: OTHER_ADMIN_EMAIL }),
    );
    if (forged) {
        record("P.6", "(c) claiming another user's email is rejected at the insert", forged.status === 403 && forged.stage === "insert", `status ${forged.status}, stage ${forged.stage}`);
    }
    await expectRejection("P.7", "(d) adminProbe without a session is rejected", () =>
        anonymous.functions.adminProbe.invoke({ claimedEmail: OTHER_ADMIN_EMAIL }),
    );
}

// R1: insert policies. Needs an Agent row (from the seed). Creates "[I1a check]" rows.
if (sections.has("r1")) {
const agents = await expectSuccess("R1.1", "agents are readable", () => client.data.Agent.select(["id"]).first(1).execute());
const agentId = agents?.[0]?.id;
if (!agentId) {
    console.log("SKIP  R1    no Agent row yet; run after the seed.");
} else {
    const now = new Date();
    const mine = { authorUserId: me.id, authorEmail: me.email };
    const ownCase = await expectSuccess("R1.2", "a case authored by the caller is accepted", () =>
        client.data.Case.create({ agent_id: agentId, text: "[I1a check] own case", category: "Checks", ...mine, createdAt: now }),
    );
    await expectRejection("R1.3", "a case with another authorUserId is rejected", () =>
        client.data.Case.create({ agent_id: agentId, text: "[I1a check] forged sub", category: "Checks", ...mine, authorUserId: "someone-else", createdAt: now }),
    );
    await expectRejection("R1.4", "a case with another authorEmail is rejected", () =>
        client.data.Case.create({ agent_id: agentId, text: "[I1a check] forged email", category: "Checks", ...mine, authorEmail: "someone.else@example.com", createdAt: now }),
    );
    if (ownCase) {
        await expectSuccess("R1.5", "a testimony authored by the caller is accepted", () =>
            client.data.Testimony.create({ case_id: ownCase.id, answer: "[I1a check]", definition: "[I1a check]", ...mine, createdAt: now }),
        );
        await expectRejection("R1.6", "a testimony with another authorUserId is rejected", () =>
            client.data.Testimony.create({ case_id: ownCase.id, answer: "x", definition: "x", ...mine, authorUserId: "someone-else", createdAt: now }),
        );
        await expectRejection("R1.7", "a dismissal with another dismissedByUserId is rejected", () =>
            client.data.CaseDismissal.create({ case_id: ownCase.id, reason: "x", dismissedByUserId: "someone-else", dismissedByEmail: me.email, createdAt: now }),
        );
        await expectRejection("R1.8", "updating a case is rejected", () =>
            client.data.Case.update({ id: ownCase.id }, { text: "[I1a check] edited" }),
        );
        await expectRejection("R1.9", "deleting a case is rejected", () => client.data.Case.delete({ id: ownCase.id }));
        // Dismissing our own check case keeps it out of the board and exercises the valid path.
        await expectSuccess("R1.10", "a dismissal by the case author is accepted", () =>
            client.data.CaseDismissal.create({ case_id: ownCase.id, reason: "[I1a check] cleanup", dismissedByUserId: me.id, dismissedByEmail: me.email, createdAt: now }),
        );
    }
}
await expectRejection("R1.11", "creating a Juror from the client is rejected", () =>
    client.data.Juror.create({ email: "forged.admin@example.com", role: "admin", active: true }),
);
await expectRejection("R1.12", "creating an Agent from the client is rejected", () =>
    client.data.Agent.create({ name: "forged", workspaceId: "x", itemId: "x", active: true }),
);
const [anyJuror] = (await client.data.Juror.select(["id"]).first(1).execute()) ?? [];
if (anyJuror) {
    await expectRejection("R1.13", "updating a Juror from the client is rejected", () =>
        client.data.Juror.update({ id: anyJuror.id }, { role: "admin", active: true }),
    );
}
await expectRejection("R1.14", "updating an AdminRequest from the client is rejected", () =>
    client.data.AdminRequest.update({ id: "00000000-0000-4000-8000-000000000001" }, { action: "forged" }),
);
}

client.auth.destroy?.();
anonymous.auth.destroy?.();
const failed = results.filter((result) => !result.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
