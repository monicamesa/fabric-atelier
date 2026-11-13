import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { i18n, initI18n } from "@/i18n/i18n";
import { viewerFor } from "../docket/viewer";
import { HearingScreen } from "./hearing.screen";

const HEARING_ID = "00000000-0000-4000-8000-0000000000d1";
const CASE_A = "00000000-0000-4000-8000-0000000000a1";
const CASE_B = "00000000-0000-4000-8000-0000000000a2";
const AGENT: AgentRow = { id: "00000000-0000-4000-8000-000000000023", name: "Sales Agent", workspaceId: "w", itemId: "i", active: true };
const JURORS: JurorRow[] = [
    { id: "j1", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", team: null, active: true },
    { id: "j2", email: "bruno.approver@example.com", displayName: "Bruno A.", role: "approver", team: null, active: true },
];
const ANA = { id: "sub-ana", email: "ana.expert@example.com" };
const BRUNO = { id: "sub-bruno", email: "bruno.approver@example.com" };
const STRANGER = { id: "sub-eva", email: "eva.outsider@example.com" };
const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

const verdicts = [
    { id: "v1", hearing_id: HEARING_ID, case_id: CASE_A, agentAnswer: "141", judgeVerdict: "correct", judgeMessage: "Yes", createdAt: ago(300) },
    { id: "v2", hearing_id: HEARING_ID, case_id: CASE_B, agentAnswer: "7", judgeVerdict: "unclear", judgeMessage: "?", createdAt: ago(250) },
];
const events = [
    { id: "e1", hearing_id: HEARING_ID, kind: "launched", detail: "job", createdAt: ago(900) },
    { id: "e2", hearing_id: HEARING_ID, kind: "completed", detail: "2 verdicts", createdAt: ago(200) },
];

function fakeClient(user: { id: string; email: string }, reviews: object[] = []) {
    const create = vi.fn(async (input: object) => ({ id: "r-new", ...input }));
    const page = (items: unknown[]) => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => ({ items, hasNextPage: false });
        return builder;
    };
    const client = {
        data: {
            Hearing: { select: () => page([{ id: HEARING_ID, agent_id: AGENT.id, stage: "production", launchedByEmail: ANA.email, caseCount: 2, criticPromptVersion: null, createdAt: ago(900) }]) },
            HearingCase: {
                select: () =>
                    page([
                        { id: "hc1", hearing_id: HEARING_ID, case_id: CASE_A, testimony_id: "t1", position: 1, question: "How many customers do we have in Spain?", expectedAnswer: "141" },
                        { id: "hc2", hearing_id: HEARING_ID, case_id: CASE_B, testimony_id: "t2", position: 2, question: "Second question?", expectedAnswer: "8" },
                    ]),
            },
            HearingEvent: { select: () => page(events) },
            Verdict: { select: () => page(verdicts) },
            VerdictReview: { select: () => page(reviews), create },
        },
        auth: { getSession: () => ({ isAuthenticated: true, user }) },
        functions: { clerkExecute: { invoke: vi.fn() } },
    } as unknown as AppRayfinClient;
    return { client, create };
}

function renderHearing(user: { id: string; email: string }, reviews: object[] = []) {
    const { client, create } = fakeClient(user, reviews);
    const viewer = viewerFor({ isAuthenticated: true, user }, JURORS);
    render(<HearingScreen client={client} hearingId={HEARING_ID} agents={[AGENT]} jurors={JURORS} viewer={viewer} onBack={() => {}} />);
    return { create };
}

beforeAll(async () => {
    initI18n("en");
});
beforeEach(async () => {
    await i18n.changeLanguage("en");
});

describe("reviewing the verdicts of a hearing", () => {
    it("agrees with the judge on a click, as the signed-in juror, and reloads", async () => {
        const { create } = renderHearing(ANA);
        const buttons = await screen.findAllByRole("button", { name: /Yes, agree/ });
        fireEvent.click(buttons[0]);
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        const input = create.mock.calls[0][0] as Record<string, unknown>;
        expect(input).toMatchObject({ verdict_id: "v1", humanVerdict: "correct", reviewerUserId: ANA.id, reviewerEmail: ANA.email });
        expect(input.reason).toBeUndefined();
        expect(input.createdAt).toBeInstanceOf(Date);
    });

    it("agreeing with an unclear verdict is an 'ambiguous' review", async () => {
        const { create } = renderHearing(ANA);
        const buttons = await screen.findAllByRole("button", { name: /Yes, agree/ });
        fireEvent.click(buttons[1]);
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create.mock.calls[0][0]).toMatchObject({ verdict_id: "v2", humanVerdict: "ambiguous" });
    });

    it("appeals with a reason and a required comment, offering only verdicts that differ from the judge's", async () => {
        const { create } = renderHearing(ANA);
        fireEvent.click((await screen.findAllByRole("button", { name: /No, appeal/ }))[0]);
        const form = screen.getByRole("group", { name: "What is the right verdict?" });
        expect(within(form).getAllByRole("radio").map((radio) => (radio as HTMLInputElement).value)).toEqual(["incorrect", "ambiguous"]);

        fireEvent.click(screen.getByRole("button", { name: "Send appeal" }));
        expect(await screen.findByText("Write why you disagree with the judge.")).toBeInTheDocument();
        expect(create).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Your explanation"), { target: { value: "  Too strict about rounding.  " } });
        fireEvent.click(screen.getByRole("button", { name: "Send appeal" }));
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create.mock.calls[0][0]).toMatchObject({ verdict_id: "v1", humanVerdict: "incorrect", reason: "judge_too_strict", comment: "Too strict about rounding." });
    });

    it("tells an approver that 'expected answer is wrong' reopens the case, and an expert that it does not", async () => {
        renderHearing(BRUNO);
        fireEvent.click((await screen.findAllByRole("button", { name: /No, appeal/ }))[0]);
        fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "expected_answer_wrong" } });
        expect(screen.getByText(/this reopens the case/)).toBeInTheDocument();
    });

    it("tells an expert that only an approver can reopen the case", async () => {
        renderHearing(ANA);
        fireEvent.click((await screen.findAllByRole("button", { name: /No, appeal/ }))[0]);
        fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "expected_answer_wrong" } });
        expect(screen.getByText(/only an approver can reopen the case/)).toBeInTheDocument();
    });

    it("works from the keyboard: J picks a verdict, A agrees, X opens the appeal, and typing in a box triggers nothing", async () => {
        const { create } = renderHearing(ANA);
        await screen.findAllByRole("button", { name: /Yes, agree/ });
        fireEvent.keyDown(window, { key: "a" });
        expect(create).not.toHaveBeenCalled();

        fireEvent.keyDown(window, { key: "j" });
        const articles = screen.getAllByRole("article");
        expect(articles[0]).toHaveAttribute("aria-current", "true");
        fireEvent.keyDown(window, { key: "j" });
        expect(articles[1]).toHaveAttribute("aria-current", "true");
        fireEvent.keyDown(window, { key: "k" });
        expect(articles[0]).toHaveAttribute("aria-current", "true");

        fireEvent.keyDown(window, { key: "x" });
        const box = await screen.findByLabelText("Your explanation");
        fireEvent.keyDown(box, { key: "a" });
        expect(create).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.keyDown(window, { key: "a" });
        await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
        expect(create.mock.calls[0][0]).toMatchObject({ verdict_id: "v1", humanVerdict: "correct" });
    });

    it("shows the keys on screen and toggles the longer help with ?", async () => {
        renderHearing(ANA);
        expect(await screen.findByText(/Keys: A agree · X appeal · J \/ K/)).toBeInTheDocument();
        expect(screen.queryByText(/Typing in a box never triggers a key/)).not.toBeInTheDocument();
        fireEvent.keyDown(window, { key: "?" });
        expect(screen.getByText(/Typing in a box never triggers a key/)).toBeInTheDocument();
    });

    it("lets only active jurors review", async () => {
        renderHearing(STRANGER);
        await screen.findAllByText("Only active jurors can review a verdict.");
        expect(screen.queryByRole("button", { name: /Yes, agree/ })).not.toBeInTheDocument();
        fireEvent.keyDown(window, { key: "j" });
        fireEvent.keyDown(window, { key: "a" });
    });

    it("shows what the jurors said and the hearing's agreement with the judge", async () => {
        const reviews = [
            { id: "r1", verdict_id: "v1", humanVerdict: "correct", reason: null, comment: null, reviewerUserId: ANA.id, reviewerEmail: ANA.email, source: null, createdAt: ago(100) },
            { id: "r2", verdict_id: "v2", humanVerdict: "correct", reason: "other", comment: "It was clear.", reviewerUserId: BRUNO.id, reviewerEmail: BRUNO.email, source: null, createdAt: ago(90) },
        ];
        renderHearing(ANA, reviews);
        const summaries = await screen.findAllByTestId("review-summary");
        expect(summaries[0]).toHaveTextContent("Jurors so far: 1 agree, 0 appeal.");
        expect(summaries[0]).toHaveTextContent("You agreed with the judge");
        expect(summaries[1]).toHaveTextContent("Jurors so far: 0 agree, 1 appeal.");
        expect(document.body.textContent).toContain("The jury agrees with the judge on 1 of 2 reviewed verdicts in this hearing.");
        expect(document.body.textContent).toContain("Judge: standard criteria");
        expect(document.body.textContent).not.toContain("Judge prompt: default");
    });

    it("does not count demo ('seed') or script ('check') reviews in the card's summary", async () => {
        const reviews = [
            { id: "r1", verdict_id: "v1", humanVerdict: "correct", reason: null, comment: null, reviewerUserId: BRUNO.id, reviewerEmail: BRUNO.email, source: "seed", createdAt: ago(100) },
            { id: "r2", verdict_id: "v1", humanVerdict: "correct", reason: null, comment: null, reviewerUserId: ANA.id, reviewerEmail: ANA.email, source: "check", createdAt: ago(90) },
        ];
        renderHearing(ANA, reviews);
        const summaries = await screen.findAllByTestId("review-summary");
        expect(summaries[0]).toHaveTextContent("No juror has reviewed this verdict yet.");
    });
});