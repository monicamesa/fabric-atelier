import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AgentRow } from "@/data/directory.service";
import { i18n, initI18n } from "@/i18n/i18n";
import { AgentTabs } from "./agent-tabs";

const real: AgentRow = { id: "a1", name: "Sales Agent", workspaceId: "ws", itemId: "item", active: true };
const example: AgentRow = { id: "a2", name: "Finance agent (example)", workspaceId: "00000000-0000-4000-8000-000000000031", itemId: "item2", active: true };

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("AgentTabs", () => {
    it("labels example agents 'Example' once, and leaves real agents as they are", () => {
        render(<AgentTabs agents={[real, example]} current="a1" onChange={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Sales Agent" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Finance agent · Example" })).toBeInTheDocument();
    });

    it("labels them in Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<AgentTabs agents={[real, example]} current="a1" onChange={vi.fn()} />);
            expect(screen.getByRole("button", { name: "Finance agent · Ejemplo" })).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("switches agent on click and renders nothing for a single agent", () => {
        const onChange = vi.fn();
        const { container, rerender } = render(<AgentTabs agents={[real, example]} current="a1" onChange={onChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Finance agent · Example" }));
        expect(onChange).toHaveBeenCalledWith("a2");
        rerender(<AgentTabs agents={[real]} current="a1" onChange={onChange} />);
        expect(container).toBeEmptyDOMElement();
    });
});
