import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { initI18n, i18n } from "@/i18n/i18n";
import type { LaunchView } from "./launch-machine";
import { LaunchScreen } from "./launch-screen";

function show(view: LaunchView, props: { onRetry?: () => void; onSignIn?: () => void; signingIn?: boolean } = {}) {
    return render(<LaunchScreen view={view} onRetry={props.onRetry ?? vi.fn()} onSignIn={props.onSignIn} signingIn={props.signingIn} />);
}

describe("LaunchScreen", () => {
    beforeAll(() => {
        initI18n("en");
    });

    it("announces the session step politely and hides the step list from assistive tech", () => {
        const { container } = show({ phase: "session", slow: false });
        const status = screen.getByRole("status");
        expect(status).toHaveAttribute("aria-live", "polite");
        expect(status).toHaveTextContent("Checking your seat on the jury…");
        expect(container.querySelector("ol")).toHaveAttribute("aria-hidden", "true");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("marks the current step and the finished ones", () => {
        const { container } = show({ phase: "docket", slow: false });
        expect(screen.getByRole("status")).toHaveTextContent("Calling the docket…");
        const steps = [...container.querySelectorAll("li")];
        expect(steps.map((step) => step.textContent)).toEqual(["1 · Session", "2 · Docket", "3 · All rise"]);
        expect(steps[0].className).toContain("text-ruled");
        expect(steps[1].className).toContain("border-action");
        expect(steps[2].className).toContain("text-text-muted");
    });

    it("says All rise when ready and strikes the gavel once", () => {
        show({ phase: "ready", slow: false });
        expect(screen.getByRole("status")).toHaveTextContent("All rise.");
        expect(screen.getByRole("img", { name: "Gavel" })).toHaveClass("launch-gavel-strike");
    });

    it("breathes while working", () => {
        show({ phase: "session", slow: false });
        expect(screen.getByRole("img", { name: "Gavel" })).toHaveClass("launch-gavel-breathe");
    });

    it("offers Try again only once it is slow, and only on a click", () => {
        const onRetry = vi.fn();
        const { rerender } = show({ phase: "docket", slow: false }, { onRetry });
        expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();

        rerender(<LaunchScreen view={{ phase: "docket", slow: true }} onRetry={onRetry} />);
        expect(screen.getByText("Taking longer than usual. Fabric may be busy; your cases are safe.")).toBeInTheDocument();
        expect(onRetry).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["busy", "Fabric is busy right now"],
        ["unknown", "Something went wrong while opening the court"],
        ["notJuror", "You are not on this jury yet. Ask an admin to add you."],
    ] as const)("shows a %s error as an alert with one primary action and collapsible details", (kind, message) => {
        const onRetry = vi.fn();
        show({ phase: "error", slow: false, error: { kind, details: "Error 503: details" } }, { onRetry });
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent("Objection!");
        expect(alert).toHaveTextContent(message);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(alert.querySelector("details")).not.toHaveAttribute("open");
        expect(alert.querySelector("summary")).toHaveTextContent("Technical details");
        expect(alert.querySelector("code")).toHaveTextContent("Error 503: details");
        expect(screen.getAllByRole("button")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("asks to sign in again when the session expired", () => {
        const onSignIn = vi.fn();
        show({ phase: "error", slow: false, error: { kind: "session", details: "AuthError: expired" } }, { onSignIn });
        expect(screen.getByRole("alert")).toHaveTextContent("Your Fabric session has expired");
        expect(screen.getAllByRole("button")).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", { name: "Sign in with Fabric" }));
        expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it("disables the sign-in action while signing in", () => {
        show({ phase: "error", slow: false, error: { kind: "session", details: "x" } }, { onSignIn: vi.fn(), signingIn: true });
        expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    });

    it("is written in Spanish when the language is Spanish", async () => {
        await i18n.changeLanguage("es");
        try {
            show({ phase: "error", slow: false, error: { kind: "unknown", details: "x" } });
            expect(screen.getByRole("alert")).toHaveTextContent("¡Protesto!");
            expect(screen.getByRole("img", { name: "Mazo" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
