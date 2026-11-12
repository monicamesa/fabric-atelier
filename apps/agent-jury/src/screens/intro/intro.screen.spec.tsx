import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { i18n, initI18n } from "@/i18n/i18n";
import { IntroScreen } from "./intro.screen";

describe("IntroScreen", () => {
    beforeAll(() => {
        initI18n("en");
    });

    it("walks through three steps and ends with Enter the courtroom", () => {
        const onDone = vi.fn();
        render(<IntroScreen onDone={onDone} />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Court is in session");
        expect(screen.queryByRole("button", { name: /Back/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Begin/ }));

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The judge is an AI");
        expect(screen.getByText("2 · The judge")).toHaveAttribute("aria-current", "step");
        fireEvent.click(screen.getByRole("button", { name: /Next/ }));

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You are the jury");
        expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument();
        expect(onDone).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /Enter the courtroom/ }));
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("links to the in-app guide only on the last step, in the selected language", async () => {
        render(<IntroScreen onDone={vi.fn()} />);
        expect(screen.queryByRole("link", { name: /Read the full guide/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Begin/ }));
        fireEvent.click(screen.getByRole("button", { name: /Next/ }));
        const link = screen.getByRole("link", { name: /Read the full guide/ });
        expect(link).toHaveAttribute("href", "#guide");
        expect(link).not.toHaveAttribute("target");

        await i18n.changeLanguage("es");
        try {
            expect(screen.getByRole("link", { name: /Leer la guía completa/ })).toHaveAttribute("href", "#guide");
        } finally {
            await i18n.changeLanguage("en");
        }
    });

    it("can go back", () => {
        render(<IntroScreen onDone={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: /Begin/ }));
        fireEvent.click(screen.getByRole("button", { name: /Back/ }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Court is in session");
    });

    it("can be skipped at any step", () => {
        const onDone = vi.fn();
        render(<IntroScreen onDone={onDone} />);
        fireEvent.click(screen.getByRole("button", { name: /Begin/ }));
        fireEvent.click(screen.getByRole("button", { name: "Skip intro" }));
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("has the language selector and says it can be replayed", () => {
        render(<IntroScreen onDone={vi.fn()} />);
        expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
        expect(screen.getByText("Shown once. You can replay it any time from How it works.")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "A gavel striking its block" })).toBeInTheDocument();
    });

    it("uses ruling and verdict words correctly in Spanish: the judge gives a verdict, the jury a ruling", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<IntroScreen onDone={vi.fn()} />);
            fireEvent.click(screen.getByRole("button", { name: /Empezar/ }));
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("El juez es una IA");
            expect(screen.getByText(/emite su veredicto/)).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
