import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import type { TickerEvent } from "@/data/ticker-events";
import { Ticker } from "./ticker";

const events: TickerEvent[] = [
    { caseId: "00000000-0000-4000-8000-0000000000a1", caseText: "How many orders were placed in fiscal year 2026?", status: "ruled", at: "2026-11-12T10:00:00.000Z", agreed: 3, total: 3 },
    { caseId: "00000000-0000-4000-8000-0000000000a2", caseText: "Which region had the highest net sales in 2025 across every channel and every single product line?", status: "disputed", at: "2026-11-12T09:00:00.000Z" },
    { caseId: "00000000-0000-4000-8000-0000000000a3", caseText: "Average order value?", status: "new", at: "2026-11-12T08:00:00.000Z" },
    { caseId: "00000000-0000-4000-8000-0000000000a4", caseText: "Revenue?", status: "ruled", at: "2026-11-12T07:00:00.000Z", agreed: 2, total: 3 },
];

function reducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn((query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
}

beforeAll(() => {
    initI18n("en");
});
beforeEach(async () => {
    await i18n.changeLanguage("en");
    reducedMotion(false);
});
afterEach(() => {
    // @ts-expect-error restore the jsdom default (no matchMedia)
    delete window.matchMedia;
});

describe("Ticker", () => {
    it("is a labelled region, with a visible label and no live region", () => {
        const { container } = render(<Ticker events={events} />);
        expect(screen.getByRole("region", { name: "Latest on the docket" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Latest on the docket/ })).toBeInTheDocument();
        expect(container.querySelector("[aria-live]")).toBeNull();
        expect(container.querySelector('[role="status"], [role="alert"]')).toBeNull();
    });

    it("writes each line as STATUS · #case question · plain words, with the status as text", () => {
        render(<Ticker events={events} />);
        const first = screen.getAllByRole("link")[0];
        expect(first).toHaveTextContent("Ruled · #00a1 How many orders were placed in fiscal year 2026? · all 3 jurors agree");
        expect(screen.getAllByRole("link")[2]).toHaveTextContent("New · #00a3 Average order value? · waiting for jury votes");
        expect(screen.getAllByRole("link")[3]).toHaveTextContent("2 of 3 jurors agree");
        expect(screen.getAllByRole("link")[1]).toHaveTextContent("jurors don't agree on the answer");
    });

    it("cuts long questions at about 50 characters", () => {
        render(<Ticker events={events} />);
        const long = screen.getAllByRole("link")[1];
        expect(long.textContent).toContain("Which region had the highest net sales in 2025 …".replace(" …", "…").slice(0, 20));
        expect(long.textContent).not.toContain("every single product line");
        expect(long.textContent).toContain("…");
    });

    it("links every line to its case detail", () => {
        render(<Ticker events={events} />);
        expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "#case/00000000-0000-4000-8000-0000000000a1");
    });

    it("hides the duplicated loop copy from assistive technology and from the tab order", () => {
        const { container } = render(<Ticker events={events} />);
        const lists = container.querySelectorAll("ul");
        expect(lists).toHaveLength(2);
        expect(lists[0]).not.toHaveAttribute("aria-hidden");
        expect(lists[1]).toHaveAttribute("aria-hidden", "true");
        expect([...lists[1].querySelectorAll("a")].every((link) => link.getAttribute("tabindex") === "-1")).toBe(true);
        expect(screen.getAllByRole("link")).toHaveLength(events.length);
    });

    it("has a visible pause button that toggles aria-pressed and the paused state", () => {
        const { container } = render(<Ticker events={events} />);
        const button = screen.getByRole("button", { name: "Pause the ticker" });
        const band = container.querySelector(".docket-ticker")!;
        expect(button).toHaveAttribute("aria-pressed", "false");
        expect(band).toHaveAttribute("data-paused", "false");
        fireEvent.click(button);
        expect(button).toHaveAttribute("aria-pressed", "true");
        expect(band).toHaveAttribute("data-paused", "true");
        fireEvent.click(button);
        expect(button).toHaveAttribute("aria-pressed", "false");
    });

    it("scrolls in the 48 s loop track when motion is allowed", () => {
        const { container } = render(<Ticker events={events} />);
        expect(container.querySelector(".docket-ticker")).toHaveAttribute("data-motion", "scroll");
        expect(container.querySelector(".docket-ticker-track")).not.toBeNull();
    });

    it("hides the band when there are fewer than 2 events", () => {
        const { container, rerender } = render(<Ticker events={events.slice(0, 1)} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<Ticker events={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("under reduced motion is a static, wrapping list: no track, no copy, no pause button", () => {
        reducedMotion(true);
        const { container } = render(<Ticker events={events} />);
        expect(container.querySelector(".docket-ticker")).toHaveAttribute("data-motion", "static");
        expect(container.querySelector(".docket-ticker-track")).toBeNull();
        const list = within(screen.getByRole("region", { name: "Latest on the docket" })).getByRole("list");
        expect(list).toHaveClass("flex-wrap");
        expect(list).not.toHaveAttribute("aria-hidden");
        expect(screen.getAllByRole("link")).toHaveLength(events.length);
        expect(screen.queryByRole("button", { name: "Pause the ticker" })).not.toBeInTheDocument();
    });

    it("speaks Spanish with 'resuelto' for the jury and no 'veredicto'", async () => {
        await i18n.changeLanguage("es");
        render(<Ticker events={events} />);
        expect(screen.getByRole("region", { name: "Último en el jurado" })).toBeInTheDocument();
        const links = screen.getAllByRole("link");
        expect(links[0]).toHaveTextContent("Resuelto · #00a1");
        expect(links[0]).toHaveTextContent("los 3 jurados están de acuerdo");
        expect(links[1]).toHaveTextContent("En disputa");
        expect(links[2]).toHaveTextContent("Nuevo");
        expect(links[3]).toHaveTextContent("2 de 3 jurados están de acuerdo");
        expect(document.body.textContent?.toLowerCase()).not.toContain("veredicto");
    });
});
