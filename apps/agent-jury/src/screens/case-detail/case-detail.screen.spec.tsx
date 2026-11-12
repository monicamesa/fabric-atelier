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

function fakeClient(testimonies: object[], user: { id: string; email: string }, failing: string[] = []) {
    const page = (items: unknown[]) => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => ({ items, hasNextPage: false });
        builder.execute = async () => items;
        return builder;
    };
    const failingPage = () => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => {
            throw new Error("Entity is not part of the schema");
        };
        return builder;
    };
    const pick = (name: string, items: unknown[]) => ({ select: () => (failing.includes(name) ? failingPage() : page(items)) });
    const createVote = vi.fn(async (input: object) => ({ id: "v-new", ...input }));
    const client = {
        data: {
            Case: { select: () => page([CASE]) },
            Testimony: { select: () => page(testimonies) },
            Vote: { select: () => page([]), create: createVote },
            CaseDismissal: { select: () => page([]) },
            Verdict: pick("Verdict", []),
            HearingCase: { select: () => page([]) },
            Hearing: { select: () => page([]) },
            VerdictReview: pick("VerdictReview", []),
        },
        auth: { getSession: () => ({ isAuthenticated: true, user }) },
    } as unknown as AppRayfinClient;
    return { client, createVote };
}

function renderCase(testimonies: object[], user: { id: string; email: string }, failing: string[] = []) {
    const { client, createVote } = fakeClient(testimonies, user, failing);
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

    it("says what is still needed, including an approver's vote, on the answer and in the case status", async () => {
        renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" });
        const card = await screen.findByRole("article", { name: /Answer A/ });
        expect(within(card).getByText(/0 of 2 votes in favour · 2 more votes in favour needed, at least one from an approver/)).toBeInTheDocument();
        expect(screen.getByText(/Needs 2 more votes in favour, at least one from an approver\./)).toBeInTheDocument();
    });

    it("tells jurors what they vote on, once, next to the answers", async () => {
        renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" });
        await screen.findByRole("article", { name: /Answer A/ });
        expect(screen.getByText(/Vote for the answer the agent SHOULD give\. You don't judge style or re-calculate/)).toBeInTheDocument();
    });

    it("shows the definition details on the answer card, so definitions can be compared at a glance", async () => {
        const detailed = { ...ANSWER, criterion: "At least one order", timeWindow: "Last 90 days", population: "All customers", source: "FactSales" };
        renderCase([detailed], { id: "sub-elena", email: "elena.expert@example.com" });
        const card = await screen.findByRole("article", { name: /Answer A/ });
        const details = within(card).getByLabelText("Definition details");
        expect(within(details).getByText("What counts")).toBeInTheDocument();
        expect(within(details).getByText("At least one order")).toBeInTheDocument();
        expect(within(details).getByText("Last 90 days")).toBeInTheDocument();
        expect(within(details).getByText("All customers")).toBeInTheDocument();
        expect(within(details).getByText("FactSales")).toBeInTheDocument();
    });

    it("shows no details list when the answer has only its one-sentence definition", async () => {
        renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" });
        const card = await screen.findByRole("article", { name: /Answer A/ });
        expect(within(card).queryByLabelText("Definition details")).not.toBeInTheDocument();
    });

    it("says what happens next for this person, under the title", async () => {
        renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" });
        await screen.findByRole("article", { name: /Answer A/ });
        expect(screen.getByText("What happens next:").parentElement).toHaveTextContent("What happens next: Your vote needed");
    });

    it("tells the author they are waiting for others", async () => {
        renderCase([ANSWER], { id: "sub-ana", email: "ana.expert@example.com" });
        await screen.findByRole("article", { name: /Answer A/ });
        expect(screen.getByText("What happens next:").parentElement).toHaveTextContent("You proposed it: waiting for others");
    });

    it("is read-only for someone who is not on the jury (D2)", async () => {
        renderCase([ANSWER], { id: "sub-visitor", email: "visitor@example.com" });
        await screen.findByRole("article", { name: /Answer A/ });
        expect(screen.queryByRole("button", { name: /Vote|Propose|Dismiss/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Only active jurors can propose cases/)).toBeInTheDocument();
    });
});

describe("CaseDetail without the review data", () => {
    it("shows a neutral notice next to the status when the reviews cannot be read, and still loads", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" }, ["VerdictReview"]);
        expect(await screen.findByRole("article", { name: /Answer A/ })).toBeInTheDocument();
        expect(screen.getByText("Reviews couldn't be loaded; this status may be out of date.")).toBeInTheDocument();
        warn.mockRestore();
    });

    it("shows no notice when the reviews load", async () => {
        renderCase([ANSWER], { id: "sub-elena", email: "elena.expert@example.com" });
        await screen.findByRole("article", { name: /Answer A/ });
        expect(screen.queryByText(/Reviews couldn't be loaded/)).not.toBeInTheDocument();
    });
});