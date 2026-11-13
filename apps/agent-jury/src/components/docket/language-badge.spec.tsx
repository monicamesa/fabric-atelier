import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import { LanguageBadge } from "./language-badge";

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("LanguageBadge", () => {
    it("shows EN or ES with an accessible name for the question language", () => {
        const { unmount } = render(<LanguageBadge language="es" />);
        expect(screen.getByLabelText("Question language: Spanish")).toHaveTextContent("es");
        unmount();
        render(<LanguageBadge language="en" />);
        expect(screen.getByLabelText("Question language: English")).toHaveTextContent("en");
    });

    it("shows nothing for older cases, with no language or an unknown one", () => {
        const { container, rerender } = render(<LanguageBadge language={undefined} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<LanguageBadge language={null} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<LanguageBadge language="fr" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("names the language in Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            render(<LanguageBadge language="en" />);
            expect(screen.getByLabelText("Idioma de la pregunta: Inglés")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
