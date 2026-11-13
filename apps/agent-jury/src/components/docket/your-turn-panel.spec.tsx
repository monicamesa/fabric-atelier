import { beforeAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const quiet = { lines: [], upToDate: false, othersWaiting: 0, hearingMayBeBusy: false } satisfies YourTurn;

describe("YourTurnPanel", () => {
    const turn: YourTurn = {
        lines: [
            { key: "approverVote", count: 1, caseId: CASE },
            { key: "vote", count: 3, caseId: CASE },
            { key: "review", count: 2, caseId: CASE, hearingId: HEARING },
            { key: "hearing", count: 4, caseId: CASE },
        ],
        upToDate: false,
        othersWaiting: 0,
        hearingMayBeBusy: true,
    };

    it("is an editorial sidebar: heading, the agent on the right, then plain lines with one link each", () => {
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={turn} />);
        expect(screen.getByRole("heading", { name: "Your turn" })).toBeInTheDocument();
        expect(screen.getByText("Sales Agent")).toBeInTheDocument();
        const items = within(screen.getByRole("list")).getAllByRole("listitem");
        expect(items).toHaveLength(4);
        expect(items[0]).toHaveTextContent("1 case needs an approver vote");
        expect(items[1]).toHaveTextContent("3 cases waiting for your vote");
        expect(items[2]).toHaveTextContent("2 judge verdicts to review");
        expect(items[3]).toHaveTextContent("4 ruled cases ready for a hearing");
        expect(within(items[1]).getByRole("link", { name: "Vote →" })).toHaveAttribute("href", `#case/${CASE}`);
        expect(within(items[2]).getByRole("link", { name: "Review the verdict →" })).toHaveAttribute("href", `#hearing/${HEARING}`);
        expect(within(items[3]).getByRole("link", { name: "Go to Hearings →" })).toHaveAttribute("href", `#hearings?agent=${AGENT}`);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("tells an admin a hearing may still be busy", () => {
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={turn} />);
        expect(screen.getByRole("note")).toHaveTextContent(/hearing started recently/);
    });

    it("says you are up to date, gives the context, and links to the open cases (the hero keeps the only Propose button)", () => {
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={{ ...quiet, upToDate: true, othersWaiting: 2 }} />);
        expect(screen.getByText("You're up to date.")).toBeInTheDocument();
        expect(screen.getByText("Nobody is waiting for your vote. 2 cases are waiting for other jurors.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "See open cases →" })).toHaveAttribute("href", `#cases?agent=${AGENT}`);
        expect(screen.queryByText(/Propose/)).not.toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("leaves out the context sentence about other jurors when nobody is waiting", () => {
        render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={{ ...quiet, upToDate: true }} />);
        expect(screen.getByText("Nobody is waiting for your vote.")).toBeInTheDocument();
    });

    it("renders nothing for someone who cannot act", () => {
        const { container } = render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={quiet} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("is in Spanish with the jury vocabulary", async () => {
        await i18n.changeLanguage("es");
        try {
            const { unmount } = render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={turn} />);
            expect(screen.getByRole("heading", { name: "Tu turno" })).toBeInTheDocument();
            expect(screen.getByText("3 casos esperan tu voto")).toBeInTheDocument();
            expect(screen.getByText("2 veredictos del juez por revisar")).toBeInTheDocument();
            expect(screen.getByText("4 casos resueltos listos para una vista")).toBeInTheDocument();
            unmount();
            render(<YourTurnPanel agentId={AGENT} agentName="Sales Agent" turn={{ ...quiet, upToDate: true, othersWaiting: 2 }} />);
            expect(screen.getByText("Estás al día.")).toBeInTheDocument();
            expect(screen.getByText("Nadie espera tu voto ahora mismo. 2 casos esperan los votos del resto del jurado.")).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Ver casos abiertos →" })).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});

describe("ProgressStrip", () => {
    const progress: Progress = {
        stages: [
            { stage: "propose", count: 2, waiting: 0 },
            { stage: "vote", count: 2, waiting: 2 },
            { stage: "ruled", count: 0, waiting: 0 },
            { stage: "hearing", count: 0, waiting: 0 },
            { stage: "review", count: 0, waiting: 0, total: 0 },
        ],
        bottleneck: "vote",
    };

    it("is one index line: the label, the count at each stage, and the bottleneck with what is needed now", () => {
        render(<ProgressStrip progress={progress} agentName="Sales Agent" />);
        expect(screen.getByText("The game")).toBeInTheDocument();
        const items = within(screen.getByRole("list")).getAllByRole("listitem");
        expect(items.map((item) => item.textContent)).toEqual(["2proposed", "2open for votes", "0ruled", "0in a hearing", "0reviewed"]);
        expect(items[1]).toHaveAttribute("aria-current", "step");
        expect(screen.getByText("Now: votes needed")).toBeInTheDocument();
        expect(screen.getByText("2 cases")).toBeInTheDocument();
    });

    it("names the other bottlenecks in words", () => {
        const hearing: Progress = { ...progress, bottleneck: "hearing", stages: progress.stages.map((item) => (item.stage === "hearing" ? { ...item, waiting: 1 } : item)) };
        render(<ProgressStrip progress={hearing} agentName="Sales Agent" />);
        expect(screen.getByText("Now: a hearing needed")).toBeInTheDocument();
        expect(screen.getByText("1 case")).toBeInTheDocument();
    });

    it("says nothing is waiting when there is no bottleneck", () => {
        render(<ProgressStrip progress={{ stages: progress.stages.slice(0, 3), bottleneck: undefined }} agentName="Sales Agent" />);
        expect(screen.getByText("Now: nothing is waiting")).toBeInTheDocument();
    });

    it("is in Spanish, with singular and plural stage names", async () => {
        await i18n.changeLanguage("es");
        try {
            const one: Progress = { ...progress, stages: progress.stages.map((item) => (item.stage === "propose" ? { ...item, count: 1 } : item)) };
            render(<ProgressStrip progress={one} agentName="Sales Agent" />);
            expect(screen.getByText("La partida")).toBeInTheDocument();
            const items = within(screen.getByRole("list")).getAllByRole("listitem");
            expect(items.map((item) => item.textContent)).toEqual(["1propuesto", "2abiertos a votación", "0resueltos", "0en vista", "0revisados"]);
            expect(screen.getByText("Ahora: faltan votos")).toBeInTheDocument();
            expect(screen.getByText("2 casos")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
