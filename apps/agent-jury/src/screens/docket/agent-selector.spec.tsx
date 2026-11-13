import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AgentRow } from "@/data/directory.service";
import { i18n, initI18n } from "@/i18n/i18n";
import { AgentSelector } from "./agent-selector";
import { AGENT_SELECTOR_ID, focusAgentSelector } from "./agent-selector-focus";

const real: AgentRow = { id: "a1", name: "Sales Agent", workspaceId: "ws", itemId: "item", active: true };
const other: AgentRow = { id: "a2", name: "Service Agent", workspaceId: "ws", itemId: "item2", active: true };
const example: AgentRow = { id: "a3", name: "Finance agent (example)", workspaceId: "00000000-0000-4000-8000-000000000031", itemId: "item3", active: true };

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("AgentSelector", () => {
    it("is labelled as step 1 in coral small caps, with the helper line", () => {
        render(<AgentSelector agents={[real, other]} current={real} onChange={vi.fn()} />);
        const label = screen.getByText("1 · Choose the agent ▸");
        expect(label).toHaveClass("uppercase");
        expect(label).toHaveClass("text-action-text");
        expect(screen.getByText("Everything you see and propose is for this agent.")).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "1 · Choose the agent ▸" })).toHaveAttribute("id", AGENT_SELECTOR_ID);
    });

    it("switches agent from the one control", () => {
        const onChange = vi.fn();
        render(<AgentSelector agents={[real, other, example]} current={real} onChange={onChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Service Agent" }));
        expect(onChange).toHaveBeenCalledWith("a2");
        expect(screen.getByRole("button", { name: "Finance agent · Example" })).toBeInTheDocument();
    });

    it("shows the agent's name, with no control, when there is only one", () => {
        render(<AgentSelector agents={[real]} current={real} onChange={vi.fn()} />);
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.getByText("Sales Agent")).toBeInTheDocument();
        expect(screen.getByText("Everything you see and propose is for this agent.")).toBeInTheDocument();
    });

    it("is in Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<AgentSelector agents={[real, other]} current={real} onChange={vi.fn()} />);
            expect(screen.getByText("1 · Elige el agente ▸")).toBeInTheDocument();
            expect(screen.getByText("Todo lo que ves y propones es para este agente.")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("moves the focus to the current agent when 'change' asks for it", () => {
        render(<AgentSelector agents={[real, other]} current={other} onChange={vi.fn()} />);
        focusAgentSelector();
        expect(screen.getByRole("button", { name: "Service Agent" })).toHaveFocus();
    });
});
