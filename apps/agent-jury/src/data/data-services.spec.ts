import { describe, expect, it, vi } from "vitest";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { createCase, createCaseDismissal, createTestimony, listCaseDismissals, listCasesByAgent } from "./cases.service";
import { listJurors } from "./directory.service";
import { NotSignedInError } from "./session-author";
import { readAllPages } from "./pagination";

interface RecordedQuery {
    entity: string;
    calls: [string, unknown][];
}

/** Fake of the fluent data client: records the chain and returns the next scripted page. */
function fakeClient(pages: Record<string, { items: unknown[]; hasNextPage: boolean; endCursor?: string }[]>, signedIn = true) {
    const queries: RecordedQuery[] = [];
    const created: { entity: string; input: unknown }[] = [];

    function entityClient(entity: string) {
        const startQuery = (method: string, arg: unknown) => {
            const record: RecordedQuery = { entity, calls: [[method, arg]] };
            queries.push(record);
            const builder: Record<string, unknown> = {};
            for (const name of ["select", "where", "orderBy", "first", "after"]) {
                builder[name] = (value: unknown) => {
                    record.calls.push([name, value]);
                    return builder;
                };
            }
            builder.executePaginated = async () => pages[entity].shift();
            return builder;
        };
        return {
            select: (fields: unknown) => startQuery("select", fields),
            create: vi.fn(async (input: unknown) => {
                created.push({ entity, input });
                return { id: "new-id", ...(input as object) };
            }),
        };
    }

    const session = signedIn
        ? { isAuthenticated: true, isAnonymous: false, user: { id: "sub-ana", email: "ana.expert@example.com" } }
        : { isAuthenticated: false, isAnonymous: false, user: null };

    const client = {
        data: new Proxy({}, { get: (_target, entity: string) => entityClient(entity) }),
        auth: { getSession: () => session },
    } as unknown as AppRayfinClient;

    return { client, queries, created };
}

describe("readAllPages", () => {
    it("follows the cursor until there are no more pages", async () => {
        const fetchPage = vi
            .fn()
            .mockResolvedValueOnce({ items: [1, 2], hasNextPage: true, endCursor: "c1" })
            .mockResolvedValueOnce({ items: [3], hasNextPage: false });
        expect(await readAllPages(fetchPage)).toEqual([1, 2, 3]);
        expect(fetchPage.mock.calls).toEqual([[undefined], ["c1"]]);
    });
});

describe("list services", () => {
    it("reads every page of cases for one agent", async () => {
        const { client, queries } = fakeClient({
            Case: [
                { items: [{ id: "c1" }], hasNextPage: true, endCursor: "cursor-1" },
                { items: [{ id: "c2" }], hasNextPage: false },
            ],
        });

        const cases = await listCasesByAgent(client, "agent-1");

        expect(cases.map((row) => row.id)).toEqual(["c1", "c2"]);
        expect(queries[0].calls).toContainEqual(["where", { agent_id: { eq: "agent-1" } }]);
        expect(queries[1].calls).toContainEqual(["after", "cursor-1"]);
    });

    it("selects the juror fields used by the validity rules", async () => {
        const { client, queries } = fakeClient({ Juror: [{ items: [], hasNextPage: false }] });
        await listJurors(client);
        expect(queries[0].calls[0]).toEqual(["select", ["id", "email", "role", "team", "active"]]);
    });

    it("does not query dismissals for an empty list of cases", async () => {
        const { client, queries } = fakeClient({});
        expect(await listCaseDismissals(client, [])).toEqual([]);
        expect(queries).toHaveLength(0);
    });
});

describe("create services", () => {
    it("takes the authorship of a case from the session", async () => {
        const { client, created } = fakeClient({});
        await createCase(client, { agentId: "agent-1", text: "How many active customers?", category: "Customers" });
        expect(created[0].entity).toBe("Case");
        expect(created[0].input).toMatchObject({
            agent_id: "agent-1",
            authorUserId: "sub-ana",
            authorEmail: "ana.expert@example.com",
        });
    });

    it("takes the authorship of testimonies and dismissals from the session", async () => {
        const { client, created } = fakeClient({});
        await createTestimony(client, { caseId: "c1", answer: "42", definition: "Orders in the last 90 days" });
        await createCaseDismissal(client, { caseId: "c1", reason: "Duplicate" });
        expect(created[0].input).toMatchObject({ case_id: "c1", authorUserId: "sub-ana" });
        expect(created[1].input).toMatchObject({ case_id: "c1", dismissedByUserId: "sub-ana", dismissedByEmail: "ana.expert@example.com" });
    });

    it("refuses to create anything without a signed-in user", async () => {
        const { client, created } = fakeClient({}, false);
        await expect(createCase(client, { agentId: "a", text: "t", category: "c" })).rejects.toBeInstanceOf(NotSignedInError);
        expect(created).toHaveLength(0);
    });
});
