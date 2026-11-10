// Prints the verdicts of a hearing on the test deployment (question, expected, agent answer, judge). Test only.
//   node scripts/i3a-inspect-hearing.mjs <hearingId>
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
if (target !== "test") process.exit(1);
const hearingIds = process.argv.slice(2);
const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });

for (const hearingId of hearingIds) {
    console.log(`=== Hearing ${hearingId.slice(0, 8)}`);
    const rows = await client.data.HearingCase.select(["case_id", "position", "question", "expectedAnswer"]).where({ hearing_id: { eq: hearingId } }).first(20).execute();
    const verdicts = await client.data.Verdict.select(["case_id", "judgeVerdict", "judgeMessage", "agentAnswer", "dataAgentVersion", "dataAgentEtag", "dataAgentLastUpdated"]).where({ hearing_id: { eq: hearingId } }).first(20).execute();
    for (const row of rows.sort((a, b) => a.position - b.position)) {
        const verdict = verdicts.find((item) => item.case_id.toLowerCase() === row.case_id.toLowerCase());
        console.log(`#${row.position} ${row.question} | expected ${row.expectedAnswer}`);
        console.log(`   agent: ${JSON.stringify(verdict?.agentAnswer)}`);
        console.log(`   judge: ${verdict?.judgeVerdict} / ${JSON.stringify(verdict?.judgeMessage)} | version ${verdict?.dataAgentVersion} etag ${verdict?.dataAgentEtag} updated ${verdict?.dataAgentLastUpdated}`);
    }
}
process.exit(0);
