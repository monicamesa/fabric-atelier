// I3b post-deploy checks on the TEST deployment, as the `rayfin login` user (an active admin). Prints only pass/fail lines.
// No hearing is launched. The one positive write is a review marked source "check" (judge trust ignores it), made on the first run only; later runs reuse that row.
//   node scripts/i3b-checks.mjs      (refuses production)
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const SPAIN_CASE = "00000000-0000-4000-8000-0000000000c1";
const SEED_REVIEW = "00000000-0000-4000-8000-0000000000c6";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
console.log(`Target: ${target} deployment`);
if (target !== "test") {
    console.log("FAIL  I3b checks only run against the test deployment");
    process.exit(1);
}
const results = [];
function record(id, description, passed, detail = "") {
    results.push(passed);
    console.log(`${passed ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${description}${detail ? ` (${detail})` : ""}`);
}

const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });
const me = client.auth.getSession().user;

const verdicts = await client.data.Verdict.select(["id", "case_id", "hearing_id", "judgeVerdict"]).first(50).execute();
const spainVerdict = verdicts.find((item) => item.case_id.toLowerCase() === SPAIN_CASE);
record("R.1", "the Spain case has a real verdict from a hearing", Boolean(spainVerdict), spainVerdict?.judgeVerdict);
const hearing = spainVerdict ? (await client.data.Hearing.select(["criticPromptVersion", "caseCount"]).where({ id: { eq: spainVerdict.hearing_id } }).first(1).execute())?.[0] : undefined;
record("R.2", "that hearing stored its critic-prompt version and had a single question", hearing?.criticPromptVersion === "default" && hearing?.caseCount === 1, `${hearing?.criticPromptVersion}, ${hearing?.caseCount} question`);

const seeded = (await client.data.VerdictReview.select(["id", "source", "reason", "reviewerEmail"]).first(50).execute()).find((row) => row.id.toLowerCase() === SEED_REVIEW);
record("R.3", "the demo review is readable and marked source 'seed'", seeded?.source === "seed" && seeded?.reason === "expected_answer_wrong");

async function tries(input) {
    try {
        await client.data.VerdictReview.create({ createdAt: new Date(), humanVerdict: "correct", ...input });
        return true;
    } catch {
        return false;
    }
}
const target1 = verdicts.find((item) => item.case_id.toLowerCase() !== SPAIN_CASE) ?? verdicts[0];
record("R.4", "a review in someone else's name (other user id) is rejected", !(await tries({ verdict_id: target1.id, reviewerUserId: "someone-else", reviewerEmail: me.email })));
record("R.5", "a review with someone else's email is rejected", !(await tries({ verdict_id: target1.id, reviewerUserId: me.id, reviewerEmail: "someone.else@example.com" })));
// The positive write happens once: later runs reuse the existing "check" row instead of adding another.
const existing = (await client.data.VerdictReview.select(["id", "verdict_id", "source", "reviewerUserId"]).first(200).execute()).find(
    (row) => row.source === "check" && row.reviewerUserId === me.id,
);
if (existing) {
    record("R.6", "a review of my own was accepted earlier (reusing the 'check' row; nothing is added)", true);
} else {
    record("R.6", "a review of my own is accepted (marked source 'check')", await tries({ verdict_id: target1.id, reviewerUserId: me.id, reviewerEmail: me.email, source: "check" }));
}

let updated = true;
try {
    await client.data.VerdictReview.update(SEED_REVIEW, { comment: "changed" });
} catch {
    updated = false;
}
record("R.7", "a review cannot be updated", !updated);
let removed = true;
try {
    await client.data.VerdictReview.delete(SEED_REVIEW);
} catch {
    removed = false;
}
record("R.8", "a review cannot be deleted", !removed);

// R9 on the server: the reopened Spain case can no longer go to a hearing (R5). Nothing is started: it is refused.
const agents = await client.data.Agent.select(["id"]).where({ name: { eq: "Sales Agent" } }).first(1).execute();
const request = await client.data.AdminRequest.create({
    requesterEmail: me.email,
    action: "launchHearing",
    payload: JSON.stringify({ agentId: agents?.[0]?.id, stage: "production", caseIds: [SPAIN_CASE], source: "check" }),
    createdAt: new Date(),
});
const launch = await client.functions.clerkExecute.invoke({ requestId: request.id });
if (launch.reason === "cooldown") {
    console.log("SKIP  R.9   the last hearing ended less than 10 minutes ago; run the check again later");
} else {
    record("R.9", "a case reopened by an approver (R9) is refused for a hearing", launch.code === 422 && launch.reason === "no_cases", `${launch.code} ${launch.reason}`);
}
const passed = results.filter(Boolean).length;
console.log(`${passed} passed, ${results.length - passed} failed`);
process.exit(passed === results.length ? 0 : 1);
