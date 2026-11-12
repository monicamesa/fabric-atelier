import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import type { Progress, YourTurn } from "@/screens/docket/your-turn";
import { ProgressStrip } from "./progress-strip";
import { YourTurnPanel } from "./your-turn-panel";

const AGENT = "00000000-0000-4000-8000-000000000021";
const CASE = "00000000-0000-4000-8000-000000000051";
const HEARING = "00000000-0000-4000-8000-000000000061";

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("YourTurnPanel", () => {
    const turn: YourTurn = {
        lines: [
            { key: "approverVote", count: 1, caseId: CASE },
            { key: "vote", count: 3, caseId: CASE },
            { key: "review", count: 2, caseId: CASE, hearingId: HEARING },
            { key: "hearing", count: 4, caseId: CASE },
        ],
        upToDate: false,
        hearingMayBeBusy: true,
    };

    it("lists each pending thing as one sentence and one action, with plurals", () => {
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={turn} onPropose={vi.fn()} />);
        const list = screen.getByRole("list");
        const items = within(list).getAllByRole("listitem");
        expect(items).toHaveLength(4);
        expect(items[0]).toHaveTextContent("1 case needs an approver vote");
        expect(items[1]).toHaveTextContent("3 cases waiting for your vote");
        expect(items[2]).toHaveTextContent("2 judge verdicts to review");
        expect(items[3]).toHaveTextContent("4 ruled cases ready for a hearing");
        expect(within(items[1]).getByRole("link", { name: "Vote" })).toHaveAttribute("href", `#case/${CASE}`);
        expect(within(items[2]).getByRole("link", { name: "Review the verdict" })).toHaveAttribute("href", `#hearing/${HEARING}`);
        expect(within(items[3]).getByRole("link", { name: "Go to Hearings" })).toHaveAttribute("href", `#hearings?agent=${AGENT}`);
    });

    it("tells an admin a hearing may still be busy", () => {
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={turn} onPropose={vi.fn()} />);
        expect(screen.getByRole("note")).toHaveTextContent(/hearing started recently/);
    });

    it("says you are up to date and offers to propose a case", () => {
        const onPropose = vi.fn();
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={{ lines: [], upToDate: true, hearingMayBeBusy: false }} onPropose={onPropose} />);
        expect(screen.getByText("You're up to date.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Propose a new case" }));
        expect(onPropose).toHaveBeenCalledTimes(1);
    });

    it("renders nothing for someone who cannot act", () => {
        const { container } = render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={{ lines: [], upToDate: false, hearingMayBeBusy: false }} onPropose={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("is in Spanish with the jury vocabulary", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={turn} onPropose={vi.fn()} />);
            expect(screen.getByRole("heading", { name: "Tu turno" })).toBeInTheDocument();
            expect(screen.getByText("3 casos esperan tu voto")).toBeInTheDocument();
            expect(screen.getByText("2 veredictos del juez por revisar")).toBeInTheDocument();
            expect(screen.getByText("4 casos resueltos listos para una vista")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});

describe("ProgressStrip", () => {
    const progress: Progress = {
        stages: [
            { stage: "propose", count: 8, waiting: 0 },
            { stage: "vote", count: 3, waiting: 3 },
            { stage: "ruled", count: 4, waiting: 0 },
            { stage: "hearing", count: 2, waiting: 2 },
            { stage: "review", count: 1, waiting: 1, total: 2 },
        ],
        bottleneck: "vote",
    };

    it("shows the five stages with their counts and highlights the bottleneck in words too", () => {
        render(<ProgressStrip progress={progress} agentName="Sales Agent" />);
        const items = within(screen.getByRole("list")).getAllByRole("listitem");
        expect(items.map((item) => item.textContent)).toEqual(["1 · Propose8cases", "2 · Vote3open", "3 · Ruled4ruled", "4 · Hearing2judged", "5 · Review1of 2 reviewed"]);
        expect(items[1]).toHaveAttribute("aria-current", "step");
        expect(screen.getByText("3 cases waiting for votes")).toBeInTheDocument();
    });

    it("says nothing is waiting when there is no bottleneck", () => {
        render(<ProgressStrip progress={{ stages: progress.stages.slice(0, 3), bottleneck: undefined }} agentName="Sales Agent" />);
        expect(screen.getByText("Nothing is waiting: the docket is moving.")).toBeInTheDocument();
    });
});
