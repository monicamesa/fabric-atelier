import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { JurorRow } from "@/data/directory.service";
import { i18n, initI18n } from "@/i18n/i18n";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { viewerFor } from "../docket/viewer";
import { FeedbackScreen } from "./feedback.screen";

const JURORS: JurorRow[] = [{ id: "j1", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", team: null, active: true }];
const ANA = { id: "sub-ana", email: "ana.expert@example.com" };

function clientWith(create = vi.fn(async () => ({ id: "f1" }))) {
    return { create, client: { data: { Feedback: { create } }, auth: { getSession: () => ({ isAuthenticated: true, user: ANA }) } } as unknown as AppRayfinClient };
}

function renderScreen(from?: string, user: typeof ANA | undefined = ANA, create?: ReturnType<typeof vi.fn>) {
    const { client, create: spy } = clientWith(create as never);
    const onBack = vi.fn();
    const viewer = viewerFor({ isAuthenticated: Boolean(user), user }, JURORS);
    render(<FeedbackScreen client={client} viewer={viewer} from={from} onBack={onBack} />);
    return { create: spy, onBack };
}

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("FeedbackScreen", () => {
    it("prefills the page it came from and sends the note, then confirms", async () => {
        const { create } = renderScreen("hearings");
        expect(screen.getByLabelText("Which page is it about? (optional)")).toHaveValue("hearings");
        fireEvent.change(screen.getByLabelText("What kind of feedback is it?"), { target: { value: "confusing" } });
        fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "I don't know what to do next." } });
        fireEvent.click(screen.getByLabelText("You can contact me about this"));
        fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
        expect(await screen.findByText("Thank you. Your feedback was sent.")).toBeInTheDocument();
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ userId: "sub-ana", type: "confusing", message: "I don't know what to do next.", page: "hearings", canContact: true }));
        expect(screen.queryByLabelText("Your message")).not.toBeInTheDocument();
    });

    it("needs a message and says so", async () => {
        const { create } = renderScreen();
        fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
        expect(await screen.findByText("Write a message.")).toBeInTheDocument();
        expect(create).not.toHaveBeenCalled();
    });

    it("limits the message to 2000 characters", () => {
        renderScreen();
        expect(screen.getByLabelText("Your message")).toHaveAttribute("maxlength", "2000");
    });

    it("starts with 'not about a page' when it was not opened from one, and ignores unknown screens", () => {
        renderScreen("00000000-0000-4000-8000-000000000001");
        expect(screen.getByLabelText("Which page is it about? (optional)")).toHaveValue("");
    });

    it("keeps what was typed and shows the error when sending fails", async () => {
        const failing = vi.fn(async () => {
            throw new Error("offline");
        });
        renderScreen("home", ANA, failing);
        fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "Please look at this." } });
        fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Your feedback wasn't sent");
        await waitFor(() => expect(screen.getByLabelText("Your message")).toHaveValue("Please look at this."));
    });

    it("is only for active jurors", () => {
        renderScreen(undefined, { id: "sub-x", email: "someone@example.com" });
        expect(screen.getByText("Only active jurors can send feedback.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Send feedback" })).not.toBeInTheDocument();
    });

    it("is in Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            renderScreen("cases");
            expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Danos tu opinión");
            expect(screen.getByLabelText("Pueden contactarme sobre esto")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Enviar opinión" })).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
