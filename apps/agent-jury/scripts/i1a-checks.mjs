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

// Spike and diagnostic Functions must no longer exist.
if (sections.has("removed")) {
    await expectRejection("X.1", "whoAmI no longer responds", () =>
        client.functions.whoAmI.invoke({ expectedSub: "x", expectedEmail: "x" }),
    );
    await expectRejection("X.2", "spikeSqlJuror no longer responds", () => client.functions.spikeSqlJuror.invoke());
    await expectRejection("X.3", "dataPing no longer responds", () => client.functions.dataPing.invoke());
    for (const name of ["echoSync", "echoAsync", "echoAsyncCtx", "echoRequestId", "echoUnion", "echoSqlInput"]) {
        await expectRejection(`X.${name}`, `${name} no longer responds`, () => client.functions[name].invoke({ text: "x", requestId: "x" }));
    }
    await expectRejection("X.4", "adminExecute (old name) no longer responds", () =>
        client.functions.adminExecute.invoke({ requestId: "00000000-0000-4000-8000-0000000000ff" }),
    );
}

// Admin requests (fallback design): the client inserts the request; clerkExecute runs only that row.
// I1b removed the probe action; readAdminLog is the harmless, read-only stand-in.
// source: "check" marks the request as automated, so the Clerk's office hides it by default.
if (sections.has("probe")) {
    const newRequest = (fields = {}) =>
        client.data.AdminRequest.create({ requesterEmail: me.email, action: "readAdminLog", payload: '{"limit":1,"source":"check"}', createdAt: new Date(), ...fields });
    const execute = (requestId) => client.functions.clerkExecute.invoke({ requestId });

    const own = await expectSuccess("F.1", "the caller can insert an AdminRequest with their own email", () => newRequest());
    await expectRejection("F.2", "(c) an AdminRequest claiming another user's email is rejected at the insert", () =>
        newRequest({ requesterEmail: OTHER_ADMIN_EMAIL }),
    );
    if (own) {
        const first = await expectSuccess("F.3", "clerkExecute runs for the caller's request", () => execute(own.id));
        if (first) {
            record(
                expectAdmin ? "F.4a" : "F.4b",
                expectAdmin ? "(a) an active admin is allowed" : "(b) a user who is not an admin is rejected",
                expectAdmin ? first.code === 200 && first.outcome === "done" : first.code === 403 && /not an active admin/.test(first.detail),
                `status ${first.code}: ${first.detail}`,
            );
        }
        const second = await expectSuccess("F.5", "clerkExecute runs a second time on the same request", () => execute(own.id));
        if (second) {
            record("F.6", "a request is single-use", second.code === 409, `status ${second.code}: ${second.detail}`);
        }
        const [result] = (await client.data.AdminRequestResult.select(["requestId", "outcome", "detail"]).where({ requestId: { eq: own.id } }).execute()) ?? [];
        record("F.7", "the author can read the result of their own request", !!result, result ? `outcome ${result.outcome}` : "");
        if (!expectAdmin) {
            record("F.7b", "the rejected attempt is recorded in the admin log", result?.outcome === "rejected", result?.detail ?? "");
        }
    }

    const expired = await expectSuccess("F.8", "an AdminRequest dated 5 minutes ago can be inserted", () =>
        newRequest({ createdAt: new Date(Date.now() - 5 * 60_000) }),
    );
    if (expired) {
        const response = await expectSuccess("F.9", "clerkExecute runs on the old request", () => execute(expired.id));
        if (response) record("F.10", "a request older than 2 minutes is rejected", response.code === 403 && /expired/.test(response.detail), `status ${response.code}: ${response.detail}`);
    }
    const future = await expectSuccess("F.11", "an AdminRequest dated 10 minutes ahead can be inserted", () =>
        newRequest({ createdAt: new Date(Date.now() + 10 * 60_000) }),
    );
    if (future) {
        const response = await expectSuccess("F.12", "clerkExecute runs on the future-dated request", () => execute(future.id));
        if (response) record("F.13", "a future-dated request is rejected", response.code === 403 && /expired|invalid date/.test(response.detail), `status ${response.code}: ${response.detail}`);
    }
    if (expectAdmin) {
        const unknown = await expectSuccess("F.14", "an AdminRequest with an unknown action can be inserted", () => newRequest({ action: "dropEverything" }));
        if (unknown) {
            const response = await expectSuccess("F.15", "clerkExecute runs on the unknown action", () => execute(unknown.id));
            if (response) record("F.16", "an unknown action is rejected", response.code === 403 && /Unknown action/.test(response.detail), `status ${response.code}: ${response.detail}`);
        }
    }

    const missing = await expectSuccess("F.17", "clerkExecute runs for an id that does not exist", () => execute("00000000-0000-4000-8000-0000000000ff"));
    if (missing) record("F.18", "an unknown request id is rejected", missing.code === 404, `status ${missing.code}`);
    await expectRejection("F.19", "(d) clerkExecute without a session is rejected", () =>
        anonymous.functions.clerkExecute.invoke({ requestId: "00000000-0000-4000-8000-0000000000ff" }),
    );
    await expectRejection("F.20", "the client cannot write AdminRequestResult", () =>
        client.data.AdminRequestResult.create({ requestId: "00000000-0000-4000-8000-0000000000ff", requesterEmail: me.email, outcome: "done", detail: "forged", processedAt: new Date() }),
    );
    if (own) {
        await expectRejection("F.21", "the client cannot update an AdminRequest", () =>
            client.data.AdminRequest.update({ id: own.id }, { action: "forged" }),
        );
    }
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
