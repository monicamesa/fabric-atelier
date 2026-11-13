import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { VerdictTracePanel } from "./verdict-trace";

const STEPS = JSON.stringify([
    { k: "source", tool: "trace.analyze_semantic_model", request: "Count the customers in Spain." },
    { k: "source", tool: "analyze.database.nl2code", request: "Count the customers in Spain." },
    { k: "query", lang: "dax", code: "EVALUATE ROW(\"n\", COUNTROWS('Customer'))" },
]);

function clientWith(execute: () => Promise<unknown>) {
    const select = vi.fn(() => ({ where: () => ({ first: () => ({ execute }) }) }));
    return { select, client: { data: { VerdictTrace: { select } } } as unknown as AppRayfinClient };
}

function open() {
    const details = screen.getByTestId("verdict-trace") as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event("toggle"));
}

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("VerdictTracePanel", () => {
    it("is closed by default and reads nothing until it is opened", () => {
        const { select, client } = clientWith(async () => []);
        render(<VerdictTracePanel client={client} verdictId="v1" />);
        expect(screen.getByText("How the agent got there")).toBeInTheDocument();
        expect(screen.getByTestId("verdict-trace")).not.toHaveAttribute("open");
        expect(screen.getByText("This is what the agent did to answer. It doesn't include the data it returned.")).toBeInTheDocument();
        expect(select).not.toHaveBeenCalled();
    });

    it("shows the timeline source → query → answer after one query, with a plain-words summary", async () => {
        const { select, client } = clientWith(async () => [{ id: "t1", steps: STEPS, truncated: false, sdkVersion: "0.1.36a0" }]);
        render(<VerdictTracePanel client={client} verdictId="v1" />);
        open();
        expect(await screen.findByText("Looked in the semantic model")).toBeInTheDocument();
        expect(screen.getByText("Turned the question into a query")).toBeInTheDocument();
        expect(screen.getAllByText("Asked: Count the customers in Spain.")).toHaveLength(2);
        expect(screen.getByText("Query (DAX)")).toBeInTheDocument();
        expect(screen.getByText(/EVALUATE ROW/)).toBeInTheDocument();
        expect(screen.getByText("The agent used its tools and wrote 1 query (DAX).")).toBeInTheDocument();
        expect(screen.getByText("Then the agent wrote the answer shown above.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Copy query" })).toBeInTheDocument();
        expect(select).toHaveBeenCalledTimes(1);
    });

    it("copies the query", async () => {
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
        const { client } = clientWith(async () => [{ id: "t1", steps: STEPS, truncated: false, sdkVersion: "x" }]);
        render(<VerdictTracePanel client={client} verdictId="v1" />);
        open();
        fireEvent.click(await screen.findByRole("button", { name: "Copy query" }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith("EVALUATE ROW(\"n\", COUNTROWS('Customer'))"));
        expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    });

    it("says nothing was recorded for older verdicts", async () => {
        const { client } = clientWith(async () => []);
        render(<VerdictTracePanel client={client} verdictId="v1" />);
        open();
        expect(await screen.findByText("No trace was recorded for this verdict.")).toBeInTheDocument();
    });

    it("fails open: a failed read only changes the accordion's own text, with a retry", async () => {
        const execute = vi
            .fn()
            .mockRejectedValueOnce(new Error("Entity VerdictTrace is not part of the schema"))
            .mockResolvedValueOnce([{ id: "t1", steps: STEPS, truncated: true, sdkVersion: "x" }]);
        const { client } = clientWith(execute);
        render(<VerdictTracePanel client={client} verdictId="v1" />);
        open();
        expect(await screen.findByText("The trace couldn't be loaded.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("Looked in the semantic model")).toBeInTheDocument();
        expect(screen.getByText("The trace was shortened to fit.")).toBeInTheDocument();
    });

    it("is in Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            const { client } = clientWith(async () => [{ id: "t1", steps: STEPS, truncated: false, sdkVersion: "x" }]);
            render(<VerdictTracePanel client={client} verdictId="v1" />);
            expect(screen.getByText("Cómo llegó el agente a su respuesta")).toBeInTheDocument();
            open();
            expect(await screen.findByText("Consultó el modelo semántico")).toBeInTheDocument();
            expect(screen.getByText("Consulta (DAX)")).toBeInTheDocument();
            expect(screen.getByText("El agente usó sus herramientas y escribió 1 consulta (DAX).")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
