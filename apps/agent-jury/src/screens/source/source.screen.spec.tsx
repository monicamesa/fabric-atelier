import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import snapshot from "@/data/source-salesmodel.json";
import { i18n, initI18n } from "@/i18n/i18n";
import { SourceScreen } from "./source.screen";

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("SourceScreen", () => {
    it("renders the supplied snapshot in section order, including all measures, tables and ideas", () => {
        const model = snapshot.models[0];
        render(<SourceScreen />);
        expect(screen.getByRole("heading", { name: "The source", level: 1 })).toBeInTheDocument();
        expect(screen.getByText(/13 November 2026/)).toBeInTheDocument();
        expect(screen.getByText(model.dataRange.en)).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent)).toEqual(["How to use this page", "Your reports: the numbers depend on the definition", "Question ideas", "The model at a glance", "What the agent can calculate", "Technical details", "Tables", "Relationships"]);
        expect(within(screen.getByRole("region", { name: "How to use this page" })).getAllByRole("listitem")).toHaveLength(3);
        expect(screen.getByRole("columnheader", { name: "Note", hidden: true })).toBeInTheDocument();
        const details = screen.getByText("Technical details").closest("details")!;
        expect(details).not.toHaveAttribute("open");
        fireEvent.click(screen.getByText("Technical details"));
        expect(details).toHaveAttribute("open");
        expect(within(details).getByRole("heading", { name: "Tables" })).toBeInTheDocument();
        expect(within(details).getByRole("heading", { name: "Relationships" })).toBeInTheDocument();
        const svg = screen.getByRole("img", { name: "SalesModel" });
        expect(svg.tagName.toLowerCase()).toBe("svg");
        expect(svg.querySelector("style")?.textContent).toContain("var(--raised)");
        expect(svg.parentElement?.parentElement).toHaveClass("overflow-x-auto");
        expect(screen.getByText("Orange = where definitions differ: net vs gross, billing vs shipping country, fiscal year.")).toBeInTheDocument();
        expect(screen.getByText("141")).toBeInTheDocument();
        expect(screen.getByText("265")).toBeInTheDocument();
        expect(screen.getByText("Either country: 292")).toBeInTheDocument();
        for (const measure of model.measures) expect(screen.getByText((_, node) => node?.tagName === "PRE" && node.textContent === measure.dax)).toBeInTheDocument();
        for (const table of model.tables) expect(screen.getByText(table.columns.join(", "))).toBeInTheDocument();
        for (const relation of model.relationships) expect(screen.getByText(relation)).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Question ideas" })).getAllByRole("listitem")).toHaveLength(8);
    });

    it("shows Spanish content and formats the snapshot's numbers", async () => {
        await act(() => i18n.changeLanguage("es"));
        try {
            render(<SourceScreen />);
            expect(screen.getByRole("heading", { name: "La fuente", level: 1 })).toBeInTheDocument();
            expect(screen.getByText(snapshot.models[0].dataRange.es)).toBeInTheDocument();
            expect(screen.getAllByText("2.183.973,48").length).toBeGreaterThan(0);
            expect(screen.getByText(snapshot.models[0].questionIdeas.es[0])).toBeInTheDocument();
            expect(screen.getByText("Tus informes: la cifra depende de la definición")).toBeInTheDocument();
            expect(screen.getByText("Lo que sabe calcular el agente")).toBeInTheDocument();
            expect(screen.getByText(/Year\s+← fiscal \(jul–jun\)/)).toBeInTheDocument();
            expect(screen.getByText("En naranja, donde cambian las definiciones: neto o bruto, país de facturación o de envío, año fiscal.")).toBeInTheDocument();
        } finally {
            await act(() => i18n.changeLanguage("en"));
        }
    });

    it("copies DAX and reports clipboard errors", async () => {
        const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        render(<SourceScreen />);
        const buttons = screen.getAllByRole("button", { name: "Copy query" });
        fireEvent.click(buttons[0]);
        expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
        expect(writeText).toHaveBeenCalledWith(snapshot.models[0].measures[0].dax);
        fireEvent.click(buttons[1]);
        expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy the query.");
    });
});
