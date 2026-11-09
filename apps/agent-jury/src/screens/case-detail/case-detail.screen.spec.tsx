import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { i18n, initI18n } from "@/i18n/i18n";
import { viewerFor } from "../docket/viewer";
import { CaseDetail } from "./case-detail.screen";

const CASE_ID = "00000000-0000-4000-8000-000000000051";
const AGENT: AgentRow = { id: "00000000-0000-4000-8000-000000000021", name: "Sales agent (example)", workspaceId: "w", itemId: "i", active: true };
const JURORS: JurorRow[] = [
    { id: "j1", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", team: "Finance", active: true },
    { id: "j2", email: "elena.expert@example.com", displayName: "Elena E.", role: "expert", team: null, active: true },
];
const recent = new Date(Date.now() - 3_600_000).toISOString();
const CASE = { id: CASE_ID, agent_id: AGENT.id, text: "Active customers in October?", category: "Sales", tags: null, authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: recent };
const ANSWER = { id: "t1", case_id: CASE_ID, answer: "2310", definition: "Customers with an order in the last 90 days.", authorUserId: "sub-ana", authorEmail: "ana.expert@example.com", createdAt: recent };

function fakeClient(testimonies: object[], user: { id: string; email: string }) {
    const page = (items: unknown[]) => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => ({ items, hasNextPage: false });
        builder.execute = async () => items;
        return builder;
    };
    const createVote = vi.fn(async (input: object) => ({ id: "v-new", ...input }));
    const client = {
        data: {
            Case: { select: () => page([CASE]) },
            Testimony: { select: () => page(testimonies) },
            Vote: { select: () => page([]), create: createVote },
            CaseDismissal: { select: () => page([]) },
        },
        auth: { getSession: () => ({ isAuthenticated: true, user }) },
    } as unknown as AppRayfinClient;
    return { client, createVote };
}

function renderCase(testimonies: object[], user: { id: string; email: string }) {
    const { client, createVote } = fakeClient(testimonies, user);
    const viewer = viewerFor({ isAuthenticated: true, user }, JURORS);
    render(<CaseDetail client={client} caseId={CASE_ID} agents={[AGENT]} jurors={JURORS} viewer={viewer} />);
    return { createVote };
}

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("CaseDetail", () => {
    it("requires a reason before sending a vote against (D4)", async () => {
        const { createVote } = renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" });
        const card = await screen.findByRole("article", { name: /Answer A/ });
        fireEvent.click(within(card).getByRole("button", { name: "Vote against" }));
        fireEvent.click(within(card).getByRole("button", { name: "Vote against answer A" }));
        expect(await within(card).findByText("Say why, so the jury can settle it.")).toBeInTheDocument();
        expect(createVote).not.toHaveBeenCalled();

        fireEvent.change(within(card).getByLabelText("Why is this answer wrong?"), { target: { value: "  Uses billing address  " } });
        fireEvent.click(within(card).getByRole("button", { name: "Vote against answer A" }));
        await waitFor(() => expect(createVote).toHaveBeenCalledTimes(1));
        expect(createVote.mock.calls[0][0]).toMatchObject({ testimony_id: "t1", value: "against", comment: "Uses billing address", voterUserId: "sub-elena" });
    });

    it("doesn't offer votes on your own answer", async () => {
        renderCase([ANSWER], { id: "sub-ana", email: "ana.expert@example.com" });
        const card = await screen.findByRole("article", { name: /Answer A/ });
        expect(within(card).queryByRole("button")).not.toBeInTheDocument();
        expect(within(card).getByText("Your own answer: your vote on it wouldn't count.")).toBeInTheDocument();
    });

    it("lets the author add their answer while the case has none (D10)", async () => {
        renderCase([], { id: "sub-ana", email: "ana.expert@example.com" });
        expect(await screen.findByRole("button", { name: "Add your answer" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Dismiss: the question is ambiguous" })).toBeInTheDocument();
    });

    it("is read-only for someone who is not on the jury (D2)", async () => {
        renderCase([ANSWER], { id: "sub-visitor", email: "visitor@example.com" });
        await screen.findByRole("article", { name: /Answer A/ });
        expect(screen.queryByRole("button", { name: /Vote|Propose|Dismiss/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Only active jurors can propose cases/)).toBeInTheDocument();
    });
});
