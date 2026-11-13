import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { ProposeCaseForm } from "./propose-case-form";

function fakeClient() {
    const createCase = vi.fn(async (input: object) => ({ id: "case-1", ...input }));
    const createTestimony = vi.fn(async (input: object) => ({ id: "t-1", ...input }));
    const client = {
        data: { Case: { create: createCase }, Testimony: { create: createTestimony } },
        auth: { getSession: () => ({ isAuthenticated: true, user: { id: "sub-ana", email: "ana.expert@example.com" } }) },
    } as unknown as AppRayfinClient;
    return { client, createCase };
}

function fill() {
    fireEvent.change(screen.getByLabelText(/^Question/), { target: { value: "How many customers do we have?" } });
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: "Customers" } });
    fireEvent.change(screen.getByLabelText(/^Answer/), { target: { value: "141" } });
    fireEvent.change(screen.getByLabelText(/^Definition/), { target: { value: "Customers whose billing country is Spain" } });
}

beforeAll(async () => {
    initI18n("en");
});

describe("ProposeCaseForm", () => {
    it("names the agent in bold in the header and offers 'change' only when there is something to change to", async () => {
        await i18n.changeLanguage("en");
        const onChangeAgent = vi.fn();
        const { client } = fakeClient();
        const { rerender } = render(<ProposeCaseForm client={client} agentId="a1" agentName="Sales Agent" categories={[]} onSaved={vi.fn()} onCancel={vi.fn()} onChangeAgent={onChangeAgent} />);
        const heading = screen.getByRole("heading", { level: 2 });
        expect(heading).toHaveTextContent("Propose a case for Sales Agent · change");
        expect(heading.querySelector("strong")).toHaveTextContent("Sales Agent");
        fireEvent.click(screen.getByRole("button", { name: "change" }));
        expect(onChangeAgent).toHaveBeenCalledTimes(1);
        rerender(<ProposeCaseForm client={client} agentId="a1" agentName="Sales Agent" categories={[]} onSaved={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.queryByRole("button", { name: "change" })).not.toBeInTheDocument();
    });

    it("lets the juror say the question is in the other language, and saves that one", async () => {
        await i18n.changeLanguage("en");
        const { client, createCase } = fakeClient();
        render(<ProposeCaseForm client={client} agentId="a1" agentName="Sales Agent" categories={[]} onSaved={vi.fn()} onCancel={vi.fn()} />);
        const group = screen.getByRole("group", { name: "Language of the question" });
        expect(within(group).getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(within(group).getByRole("button", { name: "Spanish" }));
        expect(within(group).getByRole("button", { name: "Spanish" })).toHaveAttribute("aria-pressed", "true");
        fill();
        fireEvent.click(screen.getByRole("button", { name: "Propose the case" }));
        await vi.waitFor(() => expect(createCase).toHaveBeenCalledTimes(1));
        expect(createCase).toHaveBeenCalledWith(expect.objectContaining({ language: "es" }));
    });

    it("defaults to the screen language: Spanish on the Spanish screen, and the choice still wins", async () => {
        await i18n.changeLanguage("es");
        try {
            const { client } = fakeClient();
            render(<ProposeCaseForm client={client} agentId="a1" agentName="Sales Agent" categories={[]} onSaved={vi.fn()} onCancel={vi.fn()} />);
            const group = screen.getByRole("group", { name: "Idioma de la pregunta" });
            expect(within(group).getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
            fireEvent.click(within(group).getByRole("button", { name: "Inglés" }));
            expect(within(group).getByRole("button", { name: "Inglés" })).toHaveAttribute("aria-pressed", "true");
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it.each([
        ["en", "en"],
        ["es", "es"],
    ])("saves the case with the UI language (%s)", async (ui, expected) => {
        await i18n.changeLanguage(ui);
        try {
            const { client, createCase } = fakeClient();
            render(<ProposeCaseForm client={client} agentId="a1" agentName="Sales Agent" categories={[]} onSaved={vi.fn()} onCancel={vi.fn()} />);
            if (ui === "es") {
                fireEvent.change(screen.getByLabelText(/^Pregunta/), { target: { value: "¿Cuántos clientes hay?" } });
                fireEvent.change(screen.getByLabelText(/^Categoría/), { target: { value: "Clientes" } });
                fireEvent.change(screen.getByLabelText(/^Respuesta/), { target: { value: "141" } });
                fireEvent.change(screen.getByLabelText(/^Definición/), { target: { value: "Clientes con país de facturación España" } });
                fireEvent.click(screen.getByRole("button", { name: "Proponer el caso" }));
            } else {
                fill();
                fireEvent.click(screen.getByRole("button", { name: "Propose the case" }));
            }
            await vi.waitFor(() => expect(createCase).toHaveBeenCalledTimes(1));
            expect(createCase).toHaveBeenCalledWith(expect.objectContaining({ language: expected }));
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
