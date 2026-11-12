import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { i18n, initI18n } from "@/i18n/i18n";
import { viewerFor } from "../docket/viewer";
import { HearingScreen } from "./hearing.screen";

const HEARING_ID = "00000000-0000-4000-8000-0000000000d1";
const AGENT: AgentRow = { id: "00000000-0000-4000-8000-000000000023", name: "Sales Agent", workspaceId: "w", itemId: "i", active: true };
const JURORS: JurorRow[] = [{ id: "j4", email: "dario.admin@example.com", displayName: "Dario A.", role: "admin", team: null, active: true }];
const recent = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000).toISOString();

function fakeClient(events: object[], verdicts: object[], startedSecondsAgo = 90) {
    const page = (items: unknown[]) => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => ({ items, hasNextPage: false });
        return builder;
    };
    return {
        data: {
            Hearing: { select: () => page([{ id: HEARING_ID, agent_id: AGENT.id, stage: "production", launchedByEmail: "dario.admin@example.com", caseCount: 2, createdAt: recent(startedSecondsAgo) }]) },
            HearingCase: {
                select: () =>
                    page([
                        { id: "hc1", hearing_id: HEARING_ID, case_id: "00000000-0000-4000-8000-0000000000a1", position: 1, question: "How many orders were placed in fiscal year 2026?", expectedAnswer: "997" },
                        { id: "hc2", hearing_id: HEARING_ID, case_id: "00000000-0000-4000-8000-0000000000a2", position: 2, question: "What was our revenue in fiscal year 2025?", expectedAnswer: "2,147,910.60" },
                    ]),
            },
            HearingEvent: { select: () => page(events) },
            Verdict: { select: () => page(verdicts) },
        VerdictReview: { select: () => page([]) },
        },
        auth: { getSession: () => ({ isAuthenticated: true, user: { id: "sub-dario", email: "dario.admin@example.com" } }) },
        functions: { clerkExecute: { invoke: vi.fn() } },
    } as unknown as AppRayfinClient;
}

function renderHearing(events: object[], verdicts: object[], startedSecondsAgo = 90) {
    const viewer = viewerFor({ isAuthenticated: true, user: { id: "sub-dario", email: "dario.admin@example.com" } }, JURORS);
    render(<HearingScreen client={fakeClient(events, verdicts, startedSecondsAgo)} hearingId={HEARING_ID} agents={[AGENT]} jurors={JURORS} viewer={viewer} onBack={() => {}} />);
}

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("HearingScreen", () => {
    it("shows the in-session panel with progress and the first verdict as it arrives", async () => {
        renderHearing(
            [
                { id: "e1", hearing_id: HEARING_ID, kind: "launched", detail: "job", createdAt: recent(85) },
                { id: "e2", hearing_id: HEARING_ID, kind: "started", detail: "sdk", createdAt: recent(30) },
            ],
            [{ id: "v1", hearing_id: HEARING_ID, case_id: "00000000-0000-4000-8000-0000000000a1", agentAnswer: "There were **494 orders** placed.", judgeVerdict: "incorrect", judgeMessage: "No", dataAgentVersion: "1", createdAt: recent(20) }],
        );
        const panel = await screen.findByRole("region", { name: "In session" });
        expect(within(panel).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
        expect(within(panel).getByText("Asking question 2 of 2")).toBeInTheDocument();
        const gavel = panel.querySelector("svg")!;
        expect(gavel).toHaveClass("text-ticker-text");
        expect(gavel).not.toHaveClass("text-ink");
        expect(screen.getByText("Incorrect")).toBeInTheDocument();
        expect(screen.getByText("997")).toBeInTheDocument();
        expect(screen.getByText(/494 orders/).tagName).toBe("STRONG");
        expect(document.body.textContent).not.toContain("**");
        expect(screen.getByText(/Waiting for the agent/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cancel the hearing" })).toBeInTheDocument();
    });

    it("drops the panel and the cancel button once the hearing is over", async () => {
        renderHearing(
            [
                { id: "e1", hearing_id: HEARING_ID, kind: "launched", detail: "job", createdAt: recent(85) },
                { id: "e9", hearing_id: HEARING_ID, kind: "completed", detail: "2 verdicts", createdAt: recent(10) },
            ],
            [
                { id: "v1", hearing_id: HEARING_ID, case_id: "00000000-0000-4000-8000-0000000000a1", agentAnswer: "494", judgeVerdict: "incorrect", judgeMessage: "No", createdAt: recent(40) },
                { id: "v2", hearing_id: HEARING_ID, case_id: "00000000-0000-4000-8000-0000000000a2", agentAnswer: "2,147,910.60", judgeVerdict: "correct", judgeMessage: "Yes", createdAt: recent(20) },
            ],
        );
        expect(await screen.findByText("The hearing is over: 2 verdicts.")).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "In session" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cancel the hearing" })).not.toBeInTheDocument();
        expect(screen.getByText("Correct")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    });

    it("has its own header and a way back to the list, in English and in Spanish", async () => {
        const events = [{ id: "e9", hearing_id: HEARING_ID, kind: "completed", detail: null, createdAt: recent(10) }];
        renderHearing(events, []);
        const heading = await screen.findByRole("heading", { level: 1 });
        expect(heading.textContent).toMatch(/^Hearing · .+ · Sales Agent$/);
        expect(screen.queryByRole("heading", { name: "Hearings" })).not.toBeInTheDocument();
        const back = screen.getByRole("link", { name: "← All hearings" });
        expect(back).toHaveAttribute("href", `#hearings?agent=${AGENT.id}`);

        await i18n.changeLanguage("es");
        expect((await screen.findByRole("heading", { level: 1 })).textContent).toMatch(/^Vista · .+ · Sales Agent$/);
        expect(screen.getByRole("link", { name: "← Todas las vistas" })).toBeInTheDocument();
        await i18n.changeLanguage("en");
    });

    it.each([
        ["en", 150, "About 1 minute left."],
        ["en", 90, "About 2 minutes left."],
        ["es", 150, "Queda aproximadamente 1 minuto."],
        ["es", 90, "Quedan unos 2 minutos."],
    ])("pluralises the time left (%s, started %i s ago)", async (language, startedSecondsAgo, expected) => {
        await i18n.changeLanguage(language);
        renderHearing([{ id: "e1", hearing_id: HEARING_ID, kind: "launched", detail: "job", createdAt: recent(startedSecondsAgo) }], [], startedSecondsAgo);
        const panel = await screen.findByRole("region", { name: language === "en" ? "In session" : "En sesión" });
        expect(within(panel).getByText(new RegExp(`^${expected.replace(/\./g, "\\.")}`))).toBeInTheDocument();
        await i18n.changeLanguage("en");
    });
});
