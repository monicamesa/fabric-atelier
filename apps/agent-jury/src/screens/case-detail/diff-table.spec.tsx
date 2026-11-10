import { beforeAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import { DiffTable } from "./diff-table";

const testimony = (id: string, fields: Record<string, string>) => ({
    id,
    case_id: "c1",
    answer: "1",
    definition: "d",
    authorUserId: "sub",
    authorEmail: "ana.expert@example.com",
    createdAt: "2026-11-09T12:00:00.000Z",
    ...fields,
});

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("DiffTable", () => {
    it("marks only the rows that differ, with an accessible ≠", () => {
        render(
            <DiffTable
                left={{ letter: "A", testimony: testimony("t1", { criterion: "An order", timeWindow: "Last 90 days", population: "All customers", source: "FactSales" }) }}
                right={{ letter: "B", testimony: testimony("t2", { criterion: "A contract", timeWindow: "last 90 days", population: "All customers", source: "DimContract" }) }}
            />,
        );
        const marked = screen.getAllByRole("img", { name: "they differ" }).map((marker) => marker.closest("tr")!);
        expect(marked.map((row) => within(row).getByRole("rowheader").textContent)).toEqual(["≠What counts", "≠Source table"]);
    });
});
