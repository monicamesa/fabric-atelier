import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import { buildDocket, loadDocketRecords } from "@/data/docket";
import { i18n, initI18n } from "@/i18n/i18n";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { viewerFor } from "../docket/viewer";
import type { DocketState } from "../docket/use-docket";
import { HomeScreen } from "./home.screen";

// Home must keep working when the verdict/review reads fail (for example the schema is not applied yet).
const AGENT: AgentRow = { id: "agent-1", name: "Sales Agent", workspaceId: "w", itemId: "i", active: true };
const JURORS: JurorRow[] = [{ id: "j1", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", team: null, active: true }];
const NOW = new Date("2026-11-12T12:00:00.000Z");
const CASE = { id: "case-0001", agent_id: "agent-1", text: "How many customers do we have in Spain?", category: "Customers", tags: null, authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: "2026-11-11T12:00:00.000Z" };
const TESTIMONY = { id: "t1", case_id: "case-0001", answer: "141", definition: "d", authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: "2026-11-11T12:01:00.000Z" };
const SECOND = { ...CASE, id: "case-0002", text: "Second question?" };

function clientWith(failing: string[]) {
    const rows: Record<string, unknown[]> = { Case: [CASE, SECOND], Testimony: [TESTIMONY], Vote: [], CaseDismissal: [] };
    const entity = (name: string) => ({
        select: () => {
            const builder: Record<string, unknown> = {};
            for (const method of ["where", "orderBy", "first", "after"]) builder[method] = () => builder;
            builder.executePaginated = async () => {
                if (failing.includes(name)) throw new Error(`Entity ${name} is not part of the schema`);
                return { items: rows[name] ?? [], hasNextPage: false };
            };
            return builder;
        },
    });
    const data = new Proxy({}, { get: (_t, name: string) => entity(name) });
    return { data, auth: { getSession: () => ({ isAuthenticated: true, user: { id: "sub-ana", email: "ana.expert@example.com" } }) } } as unknown as AppRayfinClient;
}

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("Home without the review data", () => {
    it("still loads the docket when the VerdictReview query fails, and marks the reviews unavailable", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const records = await loadDocketRecords(clientWith(["VerdictReview"]), "agent-1");
        expect(records.cases).toHaveLength(2);
        expect(records.reviews?.available).toBe(false);
        const docket = buildDocket(records, JURORS, undefined, NOW, "agent-1");
        expect(docket.reviewsAvailable).toBe(false);
        expect(docket.trust).toBeUndefined();
        expect(docket.cases).toHaveLength(2);
        expect(docket.ticker.map((item) => item.status).every((status) => ["new", "disputed", "ruled"].includes(status))).toBe(true);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("also survives a failing Verdict query", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const records = await loadDocketRecords(clientWith(["Verdict"]), "agent-1");
        expect(records.reviews?.available).toBe(false);
        warn.mockRestore();
    });

    it("keeps the review data when everything is readable", async () => {
        const records = await loadDocketRecords(clientWith([]), "agent-1");
        expect(records.reviews?.available).toBe(true);
    });

    it("renders Home with the docket and no judge-trust section, and shows the ticker without judge lines", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const client = clientWith(["VerdictReview"]);
        const records = await loadDocketRecords(client, "agent-1");
        const data = buildDocket(records, JURORS, undefined, NOW, "agent-1");
        const docket = { status: "success", data, reload: () => {} } as unknown as DocketState;
        const viewer = viewerFor({ isAuthenticated: true, user: { id: "sub-ana", email: "ana.expert@example.com" } }, JURORS);
        render(<HomeScreen client={client} agents={[AGENT]} agent={AGENT} docket={docket} viewer={viewer} onAgentChange={() => {}} onOpenCase={() => {}} onOpenClerk={() => {}} />);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Who judges the judge?");
        expect(screen.queryByText("Judge trust")).not.toBeInTheDocument();
        expect(screen.getAllByText(/How many customers do we have in Spain\?/).length).toBeGreaterThan(0);
        warn.mockRestore();
    });
});
