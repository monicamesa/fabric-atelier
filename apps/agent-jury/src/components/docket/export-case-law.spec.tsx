import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Docket } from "@/data/docket";
import { i18n, initI18n } from "@/i18n/i18n";
import * as download from "@/lib/download";
import { ExportCaseLaw } from "./export-case-law";

const ruledCase = (id: string, text: string) =>
    ({
        record: { id, text, category: "Sales", tags: null, authorUserId: "sub-ana", authorEmail: "ana.acme", createdAt: "2026-11-01T10:00:00.000Z" },
        testimonies: [{ id: `t-${id}`, case_id: id, answer: "997", definition: "d", authorUserId: "sub-ana", authorEmail: "ana.acme", createdAt: "2026-11-01T10:00:00.000Z" }],
        analysis: { state: "ruled", verified: true, rulingTestimonyId: `t-${id}` },
    }) as never;
const docketWith = (cases: unknown[], reviewsAvailable = true) => ({ cases, categories: [], ticker: [], reviewsAvailable }) as unknown as Docket;

beforeAll(() => {
    initI18n("en");
});
beforeEach(async () => {
    await i18n.changeLanguage("en");
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("ExportCaseLaw", () => {
    it("downloads the CSV with the agent's file name when there are ruled cases", () => {
        const save = vi.spyOn(download, "downloadTextFile").mockImplementation(() => {});
        render(<ExportCaseLaw agentName="Sales Agent" docket={docketWith([ruledCase("c1", "How many orders?")])} />);
        const button = screen.getByRole("button", { name: "Export case law" });
        expect(button).not.toHaveAttribute("aria-disabled");
        fireEvent.click(button);
        expect(save).toHaveBeenCalledTimes(1);
        const [filename, csv] = save.mock.calls[0];
        expect(filename).toMatch(/^agent-jury-sales-agent-case-law-\d{4}-\d{2}-\d{2}\.csv$/);
        expect(csv).toBe("\uFEFFquestion,expected_answer,category,tags\r\nHow many orders?,997,Sales,\r\n");
        expect(screen.getByRole("status")).toHaveTextContent("Exported 1 case.");
    });

    it("is disabled, with the reason as a tooltip, when nothing is ruled", () => {
        const save = vi.spyOn(download, "downloadTextFile").mockImplementation(() => {});
        render(<ExportCaseLaw agentName="Sales Agent" docket={docketWith([])} />);
        const button = screen.getByRole("button", { name: "Export case law" });
        expect(button).toHaveAttribute("aria-disabled", "true");
        expect(button).toHaveAttribute("title", expect.stringContaining("No ruled cases to export yet"));
        expect(button).toHaveAccessibleDescription(expect.stringContaining("the jury has to agree on an answer first"));
        fireEvent.click(button);
        expect(save).not.toHaveBeenCalled();
    });

    it("is disabled when the reviews could not be loaded, because reopened cases can't be ruled out", () => {
        const save = vi.spyOn(download, "downloadTextFile").mockImplementation(() => {});
        render(<ExportCaseLaw agentName="Sales Agent" docket={docketWith([ruledCase("c1", "Q?")], false)} />);
        const button = screen.getByRole("button", { name: "Export case law" });
        expect(button).toHaveAttribute("aria-disabled", "true");
        expect(button).toHaveAttribute("title", expect.stringContaining("reopened cases"));
        fireEvent.click(button);
        expect(save).not.toHaveBeenCalled();
    });

    it("is disabled while the docket is loading", () => {
        render(<ExportCaseLaw agentName="Sales Agent" docket={undefined} />);
        expect(screen.getByRole("button", { name: "Export case law" })).toHaveAttribute("aria-disabled", "true");
    });

    it("is labelled in Spanish", async () => {
        await i18n.changeLanguage("es");
        render(<ExportCaseLaw agentName="Sales Agent" docket={docketWith([])} />);
        const button = screen.getByRole("button", { name: "Exportar jurisprudencia" });
        expect(button.getAttribute("title")).toContain("Todavía no hay casos resueltos");
    });
});
