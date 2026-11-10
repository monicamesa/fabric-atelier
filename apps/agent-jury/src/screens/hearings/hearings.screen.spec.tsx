import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AgentRow, JurorRow } from "@/data/directory.service";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { i18n, initI18n } from "@/i18n/i18n";
import { formatDateTime } from "@/lib/format";
import type { DocketState } from "../docket/use-docket";
import { viewerFor } from "../docket/viewer";
import { HearingsScreen } from "./hearings.screen";

const AGENT: AgentRow = { id: "00000000-0000-4000-8000-000000000023", name: "Sales Agent", workspaceId: "w", itemId: "i", active: true };
const OTHER_AGENT: AgentRow = { id: "00000000-0000-4000-8000-000000000021", name: "Finance agent (example)", workspaceId: "w", itemId: "i", active: true };
const JURORS: JurorRow[] = [{ id: "j4", email: "dario.admin@example.com", displayName: "Dario A.", role: "admin", team: null, active: true }];
const ADMIN = { id: "sub-dario", email: "dario.admin@example.com" };
const at = (iso: string) => iso;

const hearing = (id: string, agent_id: string, createdAt: string) => ({ id, agent_id, stage: "production", launchedByEmail: ADMIN.email, caseCount: 2, createdAt });
const event = (hearing_id: string, kind: string, createdAt: string) => ({ id: `${hearing_id}-${kind}`, hearing_id, kind, detail: null, createdAt });

const HEARINGS = [
    hearing("00000000-0000-4000-8000-0000000000d1", AGENT.id, at("2026-11-10T11:50:00Z")),
    hearing("00000000-0000-4000-8000-0000000000d2", AGENT.id, at("2026-11-10T13:04:00Z")),
    hearing("00000000-0000-4000-8000-0000000000d3", OTHER_AGENT.id, at("2026-11-10T14:00:00Z")),
];
const EVENTS = HEARINGS.map((row) => event(row.id, "completed", "2026-11-10T14:30:00Z"));
const verdict = (hearing_id: string, case_id: string, judgeVerdict: string) => ({ id: `${hearing_id}-${case_id}`, hearing_id, case_id, agentAnswer: "x", judgeVerdict, judgeMessage: "Yes", createdAt: "2026-11-10T14:20:00Z" });
const VERDICTS = [
    verdict(HEARINGS[0].id, "c1", "correct"),
    verdict(HEARINGS[0].id, "c2", "incorrect"),
    verdict(HEARINGS[1].id, "c1", "correct"),
    verdict(HEARINGS[1].id, "c2", "correct"),
];

function ruledCase(id: string, text: string, answer: string, authorEmail = ADMIN.email) {
    return {
        record: { id, agent_id: AGENT.id, text, authorEmail },
        testimonies: [{ id: `t-${id}`, case_id: id, answer }],
        analysis: {
            state: "ruled",
            verified: true,
            rulingTestimonyId: `t-${id}`,
            tallies: [],
        },
    };
}

const docket = {
    status: "ready",
    data: {
        cases: [
            ruledCase("00000000-0000-4000-8000-0000000000a1", "How many orders were placed in fiscal year 2026?", "997"),
            ruledCase("00000000-0000-4000-8000-0000000000a2", "What is the full legal name of the company?", "A very long answer ".repeat(12)),
        ],
    },
} as unknown as DocketState;

function fakeClient() {
    const page = (items: unknown[]) => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => ({ items, hasNextPage: false });
        return builder;
    };
    return {
        data: {
            Hearing: { select: () => page(HEARINGS) },
            HearingCase: { select: () => page([]) },
            HearingEvent: { select: () => page(EVENTS) },
            Verdict: { select: () => page(VERDICTS) },
        },
        auth: { getSession: () => ({ isAuthenticated: true, user: ADMIN }) },
    } as unknown as AppRayfinClient;
}

function renderHearings() {
    const viewer = viewerFor({ isAuthenticated: true, user: ADMIN }, JURORS);
    render(
        <HearingsScreen
            client={fakeClient()}
            agents={[AGENT, OTHER_AGENT]}
            agent={AGENT}
            docket={docket}
            jurors={JURORS}
            viewer={viewer}
            onChangeAgent={() => {}}
            onOpenHearing={() => {}}
        />,
    );
}

beforeAll(async () => {
    initI18n("en");
});

describe("HearingsScreen", () => {
    it("uses the plural rules in every counter of the list, in both languages", async () => {
        await i18n.changeLanguage("en");
        renderHearings();
        expect(await screen.findByText(/1 correct · 1 incorrect · 0 unclear/)).toBeInTheDocument();
        expect(screen.getByText(/2 correct · 0 incorrect · 0 unclear/)).toBeInTheDocument();
        expect(screen.getAllByText(/2 questions/).length).toBeGreaterThan(0);
    });

    it("says 1 correcta / 1 incorrecta and 2 correctas in Spanish", async () => {
        await i18n.changeLanguage("es");
        renderHearings();
        expect(await screen.findByText(/1 correcta · 1 incorrecta · 0 sin claro/)).toBeInTheDocument();
        expect(screen.getByText(/2 correctas · 0 incorrectas · 0 sin claro/)).toBeInTheDocument();
        await i18n.changeLanguage("en");
    });

    it("puts the expected answer under the question on a phone and to its right from 640 px", async () => {
        await i18n.changeLanguage("en");
        renderHearings();
        const label = (await screen.findByRole("checkbox", { name: /How many orders were placed/ })).closest("label")!;
        const content = label.querySelector("span")!;
        expect(content).toHaveClass("flex-col");
        expect(content).toHaveClass("min-[640px]:flex-row");
        const expected = label.querySelector("[title]")!;
        expect(expected).toHaveClass("max-w-full");
        expect(expected).toHaveClass("min-[640px]:max-w-[16rem]");
    });

    it("keeps agent names on one line and lets the tab group scroll", async () => {
        await i18n.changeLanguage("en");
        renderHearings();
        const group = await screen.findByRole("group", { name: /agent/i });
        expect(group).toHaveClass("overflow-x-auto");
        for (const button of within(group).getAllByRole("button")) expect(button).toHaveClass("whitespace-nowrap");
    });

    it("lists every hearing of the agent, newest first, and none of another agent's", async () => {
        await i18n.changeLanguage("en");
        renderHearings();
        const list = (await screen.findAllByRole("listitem")).filter((item) => item.textContent?.includes("Started"));
        expect(list).toHaveLength(2);
        expect(list[0]).toHaveTextContent(formatDateTime(HEARINGS[1].createdAt, "en"));
        expect(list[1]).toHaveTextContent(formatDateTime(HEARINGS[0].createdAt, "en"));
    });

    it("shows the expected answer beside each ruled question, with the long ones cut by CSS and complete in a tooltip", async () => {
        await i18n.changeLanguage("en");
        renderHearings();
        const first = await screen.findByRole("checkbox", { name: /How many orders were placed/ });
        expect(within(first.closest("label")!).getByText("997")).toBeInTheDocument();
        const long = screen.getByRole("checkbox", { name: /full legal name/ }).closest("label")!;
        const answer = long.querySelector("[title]")!;
        expect(answer).toHaveClass("truncate");
        expect(answer.getAttribute("title")).toContain("A very long answer");
    });

    it("says how many are chosen and why the button is disabled (English)", async () => {
        await i18n.changeLanguage("en");
        renderHearings();
        expect(await screen.findByText(/0 selected · max 5/)).toBeInTheDocument();
        const start = screen.getByRole("button", { name: "Start the hearing" });
        expect(start).toBeDisabled();
        expect(start).toHaveAccessibleDescription("Choose at least one question");
        expect(screen.getByText("Choose at least one question")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("checkbox", { name: /How many orders were placed/ }));
        expect(screen.getByText(/1 selected · max 5/)).toBeInTheDocument();
        expect(screen.queryByText("Choose at least one question")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Start the hearing" })).toBeEnabled();
    });

    it("says it in Spanish too, and never calls a ruled case 'fallado'", async () => {
        await i18n.changeLanguage("es");
        renderHearings();
        expect(await screen.findByText(/0 elegidas · máximo 5/)).toBeInTheDocument();
        expect(screen.getByText("Elige al menos una pregunta")).toBeInTheDocument();
        expect(screen.getByText(/Preguntas resueltas por el jurado/)).toBeInTheDocument();
        expect(screen.getByText(/el juez compara con la respuesta que acordó el jurado/)).toBeInTheDocument();
        expect(document.body.textContent).not.toMatch(/fall/i);
        fireEvent.click(screen.getByRole("checkbox", { name: /How many orders were placed/ }));
        expect(screen.getByText(/1 elegida · máximo 5/)).toBeInTheDocument();
        await i18n.changeLanguage("en");
    });
});
