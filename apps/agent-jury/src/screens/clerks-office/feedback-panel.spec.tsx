import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { FeedbackPanel } from "./feedback-panel";

function clientReturning(result: object | Error) {
    const create = vi.fn(async () => ({ id: "request-1" }));
    const invoke = vi.fn(async () => {
        if (result instanceof Error) throw result;
        return result;
    });
    return {
        invoke,
        client: {
            data: { AdminRequest: { create } },
            auth: { getSession: () => ({ isAuthenticated: true, user: { id: "sub-dario", email: "dario.admin@example.com" } }) },
            functions: { clerkExecute: { invoke } },
        } as unknown as AppRayfinClient,
    };
}

const entry = (id: string, extra: object = {}) => ({ id, type: "idea", message: "Show me what to do next.", page: "home", canContact: false, createdAt: "2026-11-12T10:00:00.000Z", ...extra });

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("Clerk's office feedback tab", () => {
    it("lists the entries as the Function returned them (newest first), with type, page and contact choice, and no names", async () => {
        const { client } = clientReturning({
            code: 200,
            outcome: "done",
            reason: "ok",
            detail: "",
            feedback: [entry("f2", { type: "bug", message: "A line\nwith a break.", page: "cases", canContact: true }), entry("f1")],
        });
        render(<FeedbackPanel client={client} />);
        const items = within(await screen.findByRole("list")).getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent("A bug");
        expect(items[0]).toHaveTextContent("About: Cases");
        expect(items[0]).toHaveTextContent("OK to contact");
        expect(items[0]).toHaveTextContent("A line with a break.");
        expect(items[1]).toHaveTextContent("An idea");
        expect(items[1]).not.toHaveTextContent("OK to contact");
        expect(document.body.textContent).not.toContain("@");
    });

    it("says there is no feedback yet", async () => {
        const { client } = clientReturning({ code: 200, outcome: "done", reason: "ok", detail: "", feedback: [] });
        render(<FeedbackPanel client={client} />);
        expect(await screen.findByText("No feedback yet.")).toBeInTheDocument();
    });

    it("shows an objection with a retry when the Function can't be reached", async () => {
        const { client } = clientReturning(new Error("offline"));
        render(<FeedbackPanel client={client} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("The feedback could not be loaded.");
        expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });

    it("is in Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            const { client } = clientReturning({ code: 200, outcome: "done", reason: "ok", detail: "", feedback: [entry("f1", { canContact: true })] });
            render(<FeedbackPanel client={client} />);
            expect(await screen.findByRole("heading", { name: "Opiniones de los jurados" })).toBeInTheDocument();
            expect(await screen.findByText("Se puede contactar")).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
