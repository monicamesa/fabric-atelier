// Launches ONE real hearing with a single question (the Spain customers case of the I3b demo story) on the test
// deployment and waits for it, printing only a summary. Refuses to run against production.
//   node scripts/i3b-run-hearing.mjs [--max-wait=420]
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
if (target !== "test") {
    console.log("FAIL  this script only runs against the test deployment");
    process.exit(1);
}
const maxWait = Number((process.argv.find((arg) => arg.startsWith("--max-wait=")) ?? "--max-wait=420").split("=")[1]);
const SPAIN_CASE = "00000000-0000-4000-8000-0000000000c1";

const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });
const email = client.auth.getSession().user?.email;

const agents = await client.data.Agent.select(["id"]).where({ name: { eq: "Sales Agent" } }).first(1).execute();
const agentId = agents?.[0]?.id;
const request = await client.data.AdminRequest.create({
    requesterEmail: email,
    action: "launchHearing",
    payload: JSON.stringify({ agentId, stage: "production", caseIds: [SPAIN_CASE], source: "check" }),
    createdAt: new Date(),
});
const result = await client.functions.clerkExecute.invoke({ requestId: request.id });
console.log(`Launch: ${result.code} ${result.outcome} ${result.reason ?? ""} ${result.detail ?? ""}`.trim());
const hearingId = result.hearingId ?? result.resultId;
if (result.code !== 200 || !hearingId) process.exit(1);

const started = Date.now();
for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    const events = await client.data.HearingEvent.select(["kind"]).where({ hearing_id: { eq: hearingId } }).first(100).execute();
    if (events.some((event) => ["completed", "failed", "cancelled"].includes(event.kind)) || (Date.now() - started) / 1000 > maxWait) break;
}
const events = await client.data.HearingEvent.select(["kind", "detail"]).where({ hearing_id: { eq: hearingId } }).first(100).execute();
const verdicts = await client.data.Verdict.select(["judgeVerdict", "agentAnswer"]).where({ hearing_id: { eq: hearingId } }).first(5).execute();
const hearing = await client.data.Hearing.select(["criticPromptVersion"]).where({ id: { eq: hearingId } }).first(1).execute();
console.log(`Waited ${Math.round((Date.now() - started) / 1000)} s; events: ${events.map((event) => event.kind).join(", ")}`);
for (const event of events.filter((item) => item.kind === "failed")) console.log(`Failed: ${String(event.detail).slice(0, 200)}`);
console.log(`Critic prompt version stored: ${hearing?.[0]?.criticPromptVersion ?? "(none)"}`);
for (const verdict of verdicts) console.log(`Verdict: ${verdict.judgeVerdict}; agent answered: ${String(verdict.agentAnswer).replace(/\s+/g, " ").slice(0, 120)}`);
process.exit(0);
