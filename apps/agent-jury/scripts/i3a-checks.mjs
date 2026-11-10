// Runs the I3a post-deploy checks of the hearing actions as the `rayfin login` user, who must be an active admin.
// Prints only pass/fail lines. No hearing is started: the real run is a separate, deliberate step.
//   node scripts/i3a-checks.mjs [--target=production --allow-production]   (default: the test deployment)
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const MISSING = "00000000-0000-4000-8000-000000000059";
const AGENT_NAME = "Sales Agent";
const UNDER_REVIEW_CASE = "00000000-0000-4000-8000-0000000000a5";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
console.log(`Target: ${target} deployment`);

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
            payload: JSON.stringify({ ...payload, source: "check" }),
            createdAt: new Date(),
        });
        return await client.functions.clerkExecute.invoke({ requestId: request.id });
    } catch (error) {
        return { code: 0, outcome: "rejected", reason: "transport", detail: String(error?.message ?? error).slice(0, 160) };
    }
}
function expect(id, description, result, code, reason) {
    const passed = result.code === code && result.reason === reason;
    record(id, description, passed, `${result.code} ${result.reason}: ${result.detail}`);
}

const agents = await client.data.Agent.select(["id", "name", "active"]).where({ name: { eq: AGENT_NAME } }).first(1).execute();
const agent = agents?.[0];
record("H.0", `the ${AGENT_NAME} agent is registered and active`, Boolean(agent?.active));
const cases = agent ? await client.data.Case.select(["id"]).where({ agent_id: { eq: agent.id } }).first(50).execute() : [];
const first = cases?.[0]?.id;

expect("H.1", "launchHearing with no cases is rejected", await clerk("launchHearing", { agentId: agent?.id ?? MISSING, stage: "production", caseIds: [] }), 400, "invalid_payload");
expect("H.2", "launchHearing with more cases than the limit is rejected", await clerk("launchHearing", { agentId: agent?.id ?? MISSING, stage: "production", caseIds: Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-0000000000b${i}`) }), 400, "invalid_payload");
expect("H.3", "launchHearing for an unknown agent is rejected", await clerk("launchHearing", { agentId: MISSING, stage: "production", caseIds: [first ?? MISSING] }), 404, "not_found");
expect("H.4", "a case that is not ruled cannot go to a hearing", await clerk("launchHearing", { agentId: agent?.id ?? MISSING, stage: "production", caseIds: [UNDER_REVIEW_CASE] }), 422, "no_cases");
expect("H.5", "cancelHearing for an unknown hearing is rejected", await clerk("cancelHearing", { hearingId: MISSING }), 404, "not_found");
expect("H.6", "checkWithFabric for an unknown hearing is rejected", await clerk("checkWithFabric", { hearingId: MISSING }), 404, "not_found");

for (const [id, entity] of [["H.7", "Hearing"], ["H.8", "HearingCase"], ["H.9", "HearingEvent"], ["H.10", "Verdict"]]) {
    let created = true;
    try {
        await client.data[entity].create({ id: MISSING });
    } catch {
        created = false;
    }
    record(id, `the client cannot create a ${entity}`, !created);
}
const reads = await Promise.all(["Hearing", "HearingCase", "HearingEvent", "Verdict"].map((entity) => client.data[entity].select(["id"]).first(1).execute().then(() => true, () => false)));
record("H.11", "signed-in users can read hearings, their cases, events and verdicts", reads.every(Boolean));

const passed = results.filter((item) => item.passed).length;
console.log(`${passed} passed, ${results.length - passed} failed`);
process.exit(passed === results.length ? 0 : 1);
