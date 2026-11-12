import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import { GuideScreen } from "./guide.screen";

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("GuideScreen", () => {
    it("renders the English guide inside the app, with no link out of the app", () => {
        const { container } = render(<GuideScreen onBack={vi.fn()} />);
        expect(screen.getByRole("heading", { level: 1, name: "User guide" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 2, name: "How to play" })).toBeInTheDocument();
        expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
        expect(container.querySelector('a[href^="http"]')).toBeNull();
    });

    it("follows the selected language", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<GuideScreen onBack={vi.fn()} />);
            expect(screen.getByRole("heading", { level: 1, name: "Guía de usuario" })).toBeInTheDocument();
            expect(screen.getByRole("heading", { level: 2, name: "Cómo se juega" })).toBeInTheDocument();
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
