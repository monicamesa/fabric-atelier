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
        expect(screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent)).toEqual(["Reference figures", "Measures", "Tables", "Relationships", "Question ideas"]);
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
