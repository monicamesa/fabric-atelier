// Launches ONE hearing with the ruled cases of the Sales Agent on the test deployment and waits for it, printing only a summary.
//   node scripts/i3a-run-hearing.mjs [--max-wait=480]
// Refuses to run against production.
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
if (target !== "test") {
    console.log("FAIL  this script only runs against the test deployment");
    process.exit(1);
}
const maxWait = Number((process.argv.find((arg) => arg.startsWith("--max-wait=")) ?? "--max-wait=480").split("=")[1]);
const DISPUTED_CASE_SUFFIX = "0a5";

const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });
const email = client.auth.getSession().user?.email;

const agents = await client.data.Agent.select(["id"]).where({ name: { eq: "Sales Agent" } }).first(1).execute();
const agentId = agents?.[0]?.id;
const cases = await client.data.Case.select(["id"]).where({ agent_id: { eq: agentId } }).first(50).execute();
const caseIds = cases.map((row) => row.id).filter((id) => !id.toLowerCase().endsWith(DISPUTED_CASE_SUFFIX));
console.log(`Launching with ${caseIds.length} cases`);

const request = await client.data.AdminRequest.create({
    requesterEmail: email,
    action: "launchHearing",
    payload: JSON.stringify({ agentId, stage: "production", caseIds, source: "check" }),
    createdAt: new Date(),
});
const result = await client.functions.clerkExecute.invoke({ requestId: request.id });
console.log(`Launch: ${result.code} ${result.outcome} ${result.reason ?? ""} ${result.detail ?? ""}`.trim());
const hearingId = result.hearingId ?? result.resultId;
if (result.code !== 200 || !hearingId) process.exit(1);

const started = Date.now();
let kinds = [];
while ((Date.now() - started) / 1000 < maxWait) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    const events = await client.data.HearingEvent.select(["kind", "detail", "createdAt"]).where({ hearing_id: { eq: hearingId } }).first(100).execute();
    kinds = events.map((event) => event.kind);
    if (kinds.some((kind) => ["completed", "failed", "cancelled"].includes(kind))) break;
}
const events = await client.data.HearingEvent.select(["kind", "detail", "createdAt"]).where({ hearing_id: { eq: hearingId } }).first(100).execute();
const verdicts = await client.data.Verdict.select(["case_id", "judgeVerdict", "agentAnswer"]).where({ hearing_id: { eq: hearingId } }).first(20).execute();
console.log(`Waited ${Math.round((Date.now() - started) / 1000)} s`);
console.log(`Events: ${events.map((event) => event.kind).join(", ")}`);
for (const event of events.filter((item) => item.kind === "failed")) console.log(`Failed: ${String(event.detail).slice(0, 300)}`);
const count = (value) => verdicts.filter((verdict) => verdict.judgeVerdict === value).length;
console.log(`Verdicts: ${verdicts.length} (correct ${count("correct")}, incorrect ${count("incorrect")}, unclear ${count("unclear")})`);
console.log(`HEARING_ID=${hearingId}`);
process.exit(0);
