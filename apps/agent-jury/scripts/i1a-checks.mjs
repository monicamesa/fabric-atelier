// Runs the I1a post-deploy checks (R1, S-A, S-B) against the deployed app as the `rayfin login` user.
// Prints only pass/fail lines: never tokens, emails or identifiers.
//   node scripts/i1a-checks.mjs
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";

const appRoot = resolve(import.meta.dirname, "..");
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// S-A: identity read from the invocation token.
const identity = await expectSuccess("S-A.1", "whoAmI runs for a signed-in caller", () =>
    client.functions.whoAmI.invoke({ expectedSub: me.id, expectedEmail: me.email ?? "" }),
);
if (identity) {
    console.log(`        token claim names: ${identity.claimNames.join(", ")}`);
    console.log(`        token aud: ${identity.audience}; idtyp: ${identity.identityType}`);
    record("S-A.2", "the token sub matches the session user", identity.subMatches);
    record("S-A.3", "the token email claim matches the session email (R3)", identity.emailMatches);
}

const anonymous = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await expectRejection("S-A.4", "a Function invocation without a session is rejected", () =>
    anonymous.functions.whoAmI.invoke({ expectedSub: "x", expectedEmail: "x" }),
);
await expectRejection("R1.0", "reading data without a session is rejected", () =>
    anonymous.data.Juror.select(["id"]).first(1).execute(),
);

// S-A: T-SQL write and read with the app identity (only when deployed in the second step).
let spike;
if (client.functions.spikeSqlJuror) {
    spike = await expectSuccess("S-A.5", "spikeSqlJuror runs", () =>
        client.functions.spikeSqlJuror.invoke(),
    );
    if (spike) {
        record("S-A.6", "T-SQL with the app identity inserts a Juror and reads it back", !spike.error && spike.readBackMatches, spike.error ?? "");
        record("S-A.7", "T-SQL with the app identity creates the example Agent", spike.exampleAgentReady);
        for (const [table, columns] of Object.entries(spike.columns)) {
            console.log(`        ${table}: ${columns.join(", ")}`);
        }
    }
}

// S-B: rows written with T-SQL through the data API.
if (spike?.jurorId && !spike.error) {
    const juror = await expectSuccess("S-B.1", "the T-SQL juror is readable through the data API", async () => {
        // findById returns only the id; select the fields explicitly.
        const [row] = await client.data.Juror.select(["id", "email", "role", "team", "active"])
            .where({ id: { eq: spike.jurorId } })
            .execute();
        if (!row) throw new Error("not found");
        return row;
    });
    const expected = { id: spike.jurorId, email: spike.jurorEmail, role: "expert", team: "Spike", active: false };
    const mismatched = juror
        ? Object.entries(expected)
              .filter(([field, value]) => String(juror[field]).toLowerCase() !== String(value).toLowerCase())
              .map(([field]) => `${field} (${typeof juror[field]})`)
        : ["row missing"];
    record("S-B.2", "its fields round-trip (id, email, role, team, active)", mismatched.length === 0,
        mismatched.length ? `${mismatched.join(", ")}; row keys: ${Object.keys(juror ?? {}).join("/")}` : "");
}

// R1: insert policies. Needs an Agent row, created by the spike (or the seed).
const agents = await expectSuccess("R1.1", "agents are readable", () => client.data.Agent.select(["id"]).first(1).execute());
const agentId = agents?.[0]?.id;
if (!agentId) {
    console.log("SKIP  R1    no Agent row yet; run after spikeSqlJuror or the seed.");
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
if (spike?.jurorId) {
    await expectRejection("R1.13", "updating a Juror from the client is rejected", () =>
        client.data.Juror.update({ id: spike.jurorId }, { role: "admin", active: true }),
    );
}

client.auth.destroy?.();
anonymous.auth.destroy?.();
const failed = results.filter((result) => !result.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
