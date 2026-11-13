import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { STAGES } from "@/guide/stages";
import { i18n, initI18n } from "@/i18n/i18n";
import { GuideScreen } from "./guide.screen";

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("GuideScreen (How to play)", () => {
    it("opens with the title and the drawn journey of the five stages, in the order of The game line", () => {
        render(<GuideScreen onBack={vi.fn()} />);
        expect(screen.getByRole("heading", { level: 1, name: "How to play" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "The game in five stages: Propose, Vote, Ruled, Hearing, Review." })).toBeInTheDocument();
        const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
        expect(headings.slice(0, 5)).toEqual(["Propose a case", "Vote", "Ruled", "Hearing", "Review the judge"]);
    });

    it("gives each stage an inline SVG illustration, 'What you do', 'What you see' and a real example (no images to download)", () => {
        const { container } = render(<GuideScreen onBack={vi.fn()} />);
        for (const stage of STAGES) {
            const section = document.getElementById(`guide-stage-${stage}`)!;
            expect(within(section).getByText("What you do")).toBeInTheDocument();
            expect(within(section).getByText("What you see")).toBeInTheDocument();
            expect(within(section).getByText("Example")).toBeInTheDocument();
            const drawing = section.querySelector(`svg[data-stage="${stage}"]`)!;
            expect(drawing).toHaveAttribute("role", "img");
            expect(drawing.getAttribute("aria-label")).toBeTruthy();
        }
        expect(container.querySelector("img")).toBeNull();
        expect(screen.getByText(/Ana proposes “How many customers do we have in Spain\?” with the answer 141/)).toBeInTheDocument();
        expect(screen.getByText(/Bruno proposes 265 for the same question/)).toBeInTheDocument();
    });

    it("draws the Spain example in the Vote and Ruled illustrations (141 billing vs 265 shipping)", () => {
        render(<GuideScreen onBack={vi.fn()} />);
        const vote = document.querySelector('svg[data-stage="vote"]')!;
        expect(vote.textContent).toContain("141");
        expect(vote.textContent).toContain("265");
        expect(document.querySelector('svg[data-stage="ruled"]')!.textContent).toContain("141");
    });

    it("answers the five questions in an accordion that starts closed", () => {
        render(<GuideScreen onBack={vi.fn()} />);
        const faq = screen.getByRole("region", { name: "Questions people ask" });
        const items = faq.querySelectorAll("details");
        expect(items).toHaveLength(5);
        for (const [index, question] of ["Why doesn't my vote count?", "What's an approver?", "What if I disagree with the judge?", "What does “standard criteria” mean?", "What is case law?"].entries()) {
            expect(within(items[index] as HTMLElement).getByText(question)).toBeInTheDocument();
            expect(items[index]).not.toHaveAttribute("open");
        }
        expect(within(faq).getByText(/Fabric's standard evaluation criteria/)).toBeInTheDocument();
    });

    it("keeps the full text as a collapsed 'Detailed rules' section at the bottom, with no link out of the app", () => {
        const { container } = render(<GuideScreen onBack={vi.fn()} />);
        const rules = screen.getByRole("article", { name: "Detailed rules" });
        const details = rules.closest("details")!;
        expect(details).not.toHaveAttribute("open");
        expect(details.nextElementSibling).toBeNull();
        expect(within(rules).getByRole("heading", { level: 2, name: "How to play" })).toBeInTheDocument();
        expect(within(rules).getAllByRole("table").length).toBeGreaterThan(0);
        expect(container.querySelector('a[href^="http"]')).toBeNull();
    });

    it("follows the selected language", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<GuideScreen onBack={vi.fn()} />);
            expect(screen.getByRole("heading", { level: 1, name: "Cómo se juega" })).toBeInTheDocument();
            expect(screen.getByRole("img", { name: "El juego en cinco etapas: Proponer, Votar, Resuelto, Vista, Revisar." })).toBeInTheDocument();
            expect(screen.getAllByRole("heading", { level: 2 }).slice(0, 5).map((heading) => heading.textContent)).toEqual(["Proponer un caso", "Votar", "Resuelto", "Vista", "Revisar al juez"]);
            expect(document.querySelector('svg[data-stage="hearing"]')!.textContent).toContain("CORRECTA");
            expect(screen.getByText("¿Por qué no cuenta mi voto?")).toBeInTheDocument();
            expect(screen.getByRole("article", { name: "Reglas detalladas" })).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("goes back with the Back button", () => {
        const onBack = vi.fn();
        render(<GuideScreen onBack={onBack} />);
        fireEvent.click(screen.getByRole("button", { name: /Back/ }));
        expect(onBack).toHaveBeenCalledTimes(1);
    });
});
