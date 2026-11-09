// Runs the I1c post-deploy checks (votes, structured answers) as the `rayfin login` user.
// Prints only pass/fail lines: never tokens, emails or identifiers.
//   node scripts/i1c-checks.mjs [--target=production --allow-production]
// Default target: the test deployment (rayfin/.env.test). Creates one "[I1c check]" case and dismisses it.
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
console.log(`Target: ${target} deployment`);

const started = Date.now();
let requests = 0;
const results = [];
function record(id, description, passed, detail = "") {
    results.push({ id, passed });
    console.log(`${passed ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${description}${detail ? ` (${detail})` : ""}`);
}
function describeError(error) {
    const name = error?.name ?? "Error";
    const message = String(error?.message ?? error).replace(/\s+/g, " ").slice(0, 160);
    return `${name}: ${message}`;
}
async function expectSuccess(id, description, action) {
    requests += 1;
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
    requests += 1;
    try {
        await action();
        record(id, description, false, "the operation was accepted");
    } catch (error) {
        record(id, description, true, describeError(error));
    }
}

const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });
const session = client.auth.getSession();
const me = { id: session.user?.id, email: session.user?.email };
console.log(`Signed in: ${session.isAuthenticated ? "yes" : "no"}; session has email: ${me.email ? "yes" : "no"}`);

const anonymous = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await expectRejection("V.0", "reading votes without a session is rejected", () => anonymous.data.Vote.select(["id"]).first(1).execute());

const agents = await expectSuccess("V.1", "agents are readable", () => client.data.Agent.select(["id"]).where({ active: { eq: true } }).first(1).execute());
const agentId = agents?.[0]?.id;
if (!agentId) {
    console.log("SKIP  V     no active Agent row; run after the seed.");
} else {
    const now = () => new Date();
    const author = { authorUserId: me.id, authorEmail: me.email };
    const details = { criterion: "[I1c check] an order", timeWindow: "last 90 days", population: "all customers", source: "FactSales" };
    const ownCase = await expectSuccess("V.2", "a case authored by the caller is accepted", () =>
        client.data.Case.create({ agent_id: agentId, text: "[I1c check] votes", category: "Checks", ...author, createdAt: now() }),
    );
    const testimony = ownCase
        ? await expectSuccess("V.3", "a testimony with the four definition details is accepted", () =>
              client.data.Testimony.create({ case_id: ownCase.id, answer: "[I1c check]", definition: "[I1c check]", ...details, ...author, createdAt: now() }),
          )
        : undefined;
    if (testimony) {
        const [stored] =
            (await expectSuccess("V.4", "the testimony can be read back", () =>
                client.data.Testimony.select(["id", "criterion", "timeWindow", "population", "source"]).where({ id: { eq: testimony.id } }).execute(),
            )) ?? [];
        record("V.5", "the definition details are stored as written", Boolean(stored) && Object.entries(details).every(([key, value]) => stored[key] === value));
        await expectRejection("V.6", "a definition detail over 300 characters is rejected", () =>
            client.data.Testimony.create({ case_id: ownCase.id, answer: "x", definition: "x", criterion: "x".repeat(301), ...author, createdAt: now() }),
        );

        const voter = { voterUserId: me.id, voterEmail: me.email };
        const vote = (fields = {}) => client.data.Vote.create({ testimony_id: testimony.id, value: "for", ...voter, createdAt: now(), ...fields });
        const own = await expectSuccess("V.7", "a vote with the caller's own identity is accepted", () => vote());
        await expectSuccess("V.8", "a vote against with a comment is accepted", () => vote({ value: "against", comment: "[I1c check] reason" }));
        await expectRejection("V.9", "a vote with another voterUserId is rejected", () => vote({ voterUserId: "someone-else" }));
        await expectRejection("V.10", "a vote with another voterEmail is rejected", () => vote({ voterEmail: "someone.else@example.com" }));
        await expectRejection("V.11", "a vote with a value other than for/against is rejected", () => vote({ value: "maybe" }));
        await expectRejection("V.12", "a comment over 1000 characters is rejected", () => vote({ value: "against", comment: "x".repeat(1001) }));
        if (own) {
            await expectRejection("V.13", "updating a vote is rejected", () => client.data.Vote.update({ id: own.id }, { value: "against" }));
            await expectRejection("V.14", "deleting a vote is rejected", () => client.data.Vote.delete({ id: own.id }));
        }
        const votes =
            (await expectSuccess("V.15", "the testimony's votes can be read", () =>
                client.data.Vote.select(["id", "value", "comment", "voterUserId", "createdAt"]).where({ testimony_id: { eq: testimony.id } }).execute(),
            )) ?? [];
        record("V.16", "both accepted votes are kept (votes are never overwritten)", votes.length === 2, `${votes.length} votes`);
        await expectRejection("V.17", "updating a testimony is rejected", () => client.data.Testimony.update({ id: testimony.id }, { answer: "edited" }));
    }
    if (ownCase) {
        await expectSuccess("V.18", "the check case is dismissed by its author (cleanup)", () =>
            client.data.CaseDismissal.create({ case_id: ownCase.id, reason: "[I1c check] cleanup", dismissedByUserId: me.id, dismissedByEmail: me.email, createdAt: now() }),
        );
    }
}

client.auth.destroy?.();
anonymous.auth.destroy?.();
const failed = results.filter((result) => !result.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
console.log(`Requests: ${requests} data requests in ${((Date.now() - started) / 1000).toFixed(1)} s (including sign-in).`);
// Exit explicitly: an open SDK handle can keep the process alive when its output is piped.
process.exit(failed === 0 ? 0 : 1);
