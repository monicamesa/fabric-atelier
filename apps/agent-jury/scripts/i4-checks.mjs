// I4 checks, as the `rayfin login` user (an active admin). Prints only pass/fail lines.
//   node scripts/i4-checks.mjs                                         TEST: schema, policies, readFeedback, trace shape, language
//   node scripts/i4-checks.mjs --target=production --allow-production  PRODUCTION, read-only: only that the new tables and the column exist
// On TEST the positive writes happen once (a "[check]" feedback note and a "[check]" case with a language); later runs reuse
// those rows instead of adding more. No hearing is launched here: the trace checks read the traces of the hearings that ran.
import { getAuthenticatedToken } from "@microsoft/rayfin-cli/auth";
import { RayfinClient } from "@microsoft/rayfin-client";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";
import { resolveTarget } from "./lib/deployment-target.mjs";

const { target, tenantId, baseUrl, publishableKey } = resolveTarget();
const readOnly = target === "production";
console.log(`Target: ${target} deployment${readOnly ? " (read-only)" : ""}`);

const results = [];
function record(id, description, passed, detail = "") {
    results.push(passed);
    console.log(`${passed ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${description}${detail ? ` (${detail})` : ""}`);
}
const rejected = async (action) => {
    try {
        await action();
        return false;
    } catch {
        return true;
    }
};

const { token } = await getAuthenticatedToken(["https://analysis.windows.net/powerbi/api/Item.Execute.All"], { tenantId });
const client = new RayfinClient({ baseUrl, publishableKey, authStorage: false });
await signInWithEntraToken(client.auth, { entraToken: token });
const me = client.auth.getSession().user;

// Schema: the new tables and the column exist and can be read.
const cases = await client.data.Case.select(["id", "language", "text"]).first(200).execute().catch(() => undefined);
record("S.1", "Case.language can be read", Array.isArray(cases), cases ? `${cases.filter((row) => row.language).length} of ${cases.length} cases have a language` : "");
const traces = await client.data.VerdictTrace.select(["id", "verdict_id", "steps", "truncated", "sdkVersion"]).first(200).execute().catch(() => undefined);
record("S.2", "VerdictTrace can be read", Array.isArray(traces), traces ? `${traces.length} traces` : "");
const own = await client.data.Feedback.select(["id", "message", "userId"]).first(200).execute().catch(() => undefined);
record("S.3", "Feedback can be read by its owner", Array.isArray(own), own ? `${own.length} own notes` : "");

if (!readOnly) {
    // Feedback is insert-only and cannot be written in someone else's name.
    record("F.1", "a note in someone else's name is rejected", await rejected(() => client.data.Feedback.create({ userId: "someone-else", type: "idea", message: "x", canContact: false, createdAt: new Date() })));
    const existing = own?.find((row) => row.message.startsWith("[check]"));
    if (existing) {
        record("F.2", "a note of my own was accepted earlier (reusing the '[check]' row; nothing is added)", true);
    } else {
        let ok = true;
        await client.data.Feedback.create({ userId: me.id, type: "other", message: "[check] automated I4 check, safe to ignore", page: "feedback", canContact: false, createdAt: new Date() }).catch(() => {
            ok = false;
        });
        record("F.2", "a note of my own is accepted", ok);
    }
    const ownNow = await client.data.Feedback.select(["id", "message"]).first(200).execute().catch(() => []);
    const row = ownNow.find((item) => item.message.startsWith("[check]")) ?? ownNow[0];
    record("F.3", "a note cannot be updated or deleted", row ? (await rejected(() => client.data.Feedback.update(row.id, { message: "changed" }))) && (await rejected(() => client.data.Feedback.delete(row.id))) : false);

    // Admins read the notes through the Function; the entries carry no user id and no email.
    const request = await client.data.AdminRequest.create({ requesterEmail: me.email, action: "readFeedback", payload: JSON.stringify({ limit: 50, source: "check" }), createdAt: new Date() });
    const read = await client.functions.clerkExecute.invoke({ requestId: request.id });
    const entries = read.feedback ?? [];
    const allowed = new Set(["id", "type", "message", "page", "canContact", "createdAt", "authorName"]);
    record("F.4", "readFeedback returns the notes with no user id or email", read.code === 200 && entries.length > 0 && entries.every((entry) => Object.keys(entry).every((key) => allowed.has(key))), `${read.code} ${read.reason}, ${entries.length} notes`);
    record("F.5", "the '[check]' note is among them", entries.some((entry) => entry.message.startsWith("[check]")));
    record("F.6", "notes that don't allow contact stay anonymous", entries.filter((entry) => !entry.canContact).every((entry) => entry.authorName === undefined));
    if (!entries.some((entry) => entry.message.startsWith("[check] contact"))) {
        await client.data.Feedback.create({ userId: me.id, type: "other", message: "[check] contact allowed, safe to ignore", page: "feedback", canContact: true, createdAt: new Date() }).catch(() => undefined);
    }
    const again = await client.functions.clerkExecute.invoke({
        requestId: (await client.data.AdminRequest.create({ requesterEmail: me.email, action: "readFeedback", payload: JSON.stringify({ limit: 50, source: "check" }), createdAt: new Date() })).id,
    });
    const named = (again.feedback ?? []).find((entry) => entry.message.startsWith("[check] contact"));
    record("F.7", "a note that allows contact shows the author's display name, never an email", Boolean(named?.canContact) && typeof named?.authorName === "string" && named.authorName.length > 0 && !named.authorName.includes("@"), named ? "name resolved" : "note missing");

    // Traces are written only by the notebook.
    const sample = traces?.[0];
    record("T.1", "a trace cannot be created, updated or deleted from the client", (await rejected(() => client.data.VerdictTrace.create({ verdict_id: "00000000-0000-4000-8000-0000000000f1", steps: "[]", truncated: false, sdkVersion: "x", createdAt: new Date() }))) && (sample ? (await rejected(() => client.data.VerdictTrace.update(sample.id, { steps: "[]" }))) && (await rejected(() => client.data.VerdictTrace.delete(sample.id))) : true));
    if (!traces || traces.length === 0) {
        console.log("SKIP  T.2   no trace yet: run a hearing on the test deployment (scripts/i3b-run-hearing.mjs) and check again");
    } else {
        const problems = [];
        for (const trace of traces) {
            let steps;
            try {
                steps = JSON.parse(trace.steps);
            } catch {
                problems.push("not JSON");
                continue;
            }
            if (trace.steps.length > 4000) problems.push("longer than 4000");
            if (/https?:\/\//i.test(trace.steps)) problems.push("has a URL");
            if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(trace.steps)) problems.push("has a GUID");
            for (const step of steps) {
                if (step.k !== "source" && step.k !== "query") problems.push(`step kind ${step.k}`);
                if (Object.keys(step).some((key) => !["k", "tool", "request", "lang", "code"].includes(key))) problems.push("unexpected field");
            }
            if (!steps.some((step) => step.k === "query")) problems.push("no query step");
        }
        record("T.2", "every trace holds only sources and queries, no URL or id, within 4000 characters", problems.length === 0, problems.length ? [...new Set(problems)].join(", ") : `${traces.length} traces; sdk ${traces[0].sdkVersion}`);
    }

    // Case.language is a closed set; the positive write happens once.
    const agents = await client.data.Agent.select(["id"]).where({ name: { eq: "Sales Agent" } }).first(1).execute();
    const agentId = agents?.[0]?.id;
    const base = { agent_id: agentId, category: "Check", authorUserId: me.id, authorEmail: me.email, createdAt: new Date() };
    record("L.1", "a language outside en/es is rejected", await rejected(() => client.data.Case.create({ ...base, text: "[check] invalid language", language: "fr" })));
    let checkCase = cases?.find((row) => row.text.startsWith("[check] language"));
    if (!checkCase) checkCase = await client.data.Case.create({ ...base, text: "[check] language badge case", language: "es" }).catch(() => undefined);
    const readBack = checkCase ? (await client.data.Case.select(["language"]).where({ id: { eq: checkCase.id } }).first(1).execute())?.[0] : undefined;
    record("L.2", "a case keeps the language it was written in", readBack?.language === "es");
}

const passed = results.filter(Boolean).length;
console.log(`${passed} passed, ${results.length - passed} failed`);
process.exit(passed === results.length ? 0 : 1);
