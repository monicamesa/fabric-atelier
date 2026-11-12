import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/hooks/auth.context";
import { initI18n } from "@/i18n/i18n";
import { LaunchClockContext } from "./launch-clock.context";
import { LaunchGate } from "./launch-gate";
import type { LaunchStage } from "./launch-machine";

const PENDING: LaunchStage = { status: "pending" };
const OK: LaunchStage = { status: "ok" };

function renderGate(session: LaunchStage, docket: LaunchStage, handlers: { onRetry?: () => void; onReady?: () => void } = {}, restart = vi.fn()) {
    const element = (s: LaunchStage, d: LaunchStage) => (
        <LaunchClockContext.Provider value={{ startedAt: performance.now(), restart }}>
            <LaunchGate session={s} docket={d} {...handlers} />
        </LaunchClockContext.Provider>
    );
    const view = render(element(session, docket));
    return { ...view, update: (s: LaunchStage, d: LaunchStage) => view.rerender(element(s, d)), restart };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("LaunchGate over time", () => {
    beforeAll(() => {
        initI18n("en");
    });
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("goes Session → Docket → All rise on the real stages, then calls onReady once after the hold", () => {
        const onReady = vi.fn();
        const { update } = renderGate(PENDING, PENDING, { onReady });
        expect(screen.getByRole("status")).toHaveTextContent("Checking your seat on the jury…");

        update(OK, PENDING);
        expect(screen.getByRole("status")).toHaveTextContent("Calling the docket…");

        update(OK, OK);
        expect(screen.getByRole("status")).toHaveTextContent("Calling the docket…");
        advance(799);
        expect(screen.getByRole("status")).toHaveTextContent("Calling the docket…");
        advance(1);
        expect(screen.getByRole("status")).toHaveTextContent("All rise.");
        expect(onReady).not.toHaveBeenCalled();

        advance(599);
        expect(onReady).not.toHaveBeenCalled();
        advance(1);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it("shows the slow message after about 8 seconds and retries only when the user clicks", () => {
        const onRetry = vi.fn();
        const { restart } = renderGate(OK, PENDING, { onRetry });

        advance(7_999);
        expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
        advance(1);
        expect(screen.getByText(/Taking longer than usual/)).toBeInTheDocument();

        advance(60_000);
        expect(onRetry).not.toHaveBeenCalled();
        expect(restart).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(restart).toHaveBeenCalledTimes(1);
    });

    it("shows an error as soon as a stage fails, with no timers left running", () => {
        const failed: LaunchStage = { status: "error", error: { kind: "busy", details: "Error 503: Bad gateway" } };
        renderGate(OK, failed);
        expect(screen.getByRole("alert")).toHaveTextContent("Fabric is busy right now");
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("LaunchGate sign-in", () => {
    beforeAll(() => {
        initI18n("en");
    });

    function auth(overrides: Partial<AuthContextValue>): AuthContextValue {
        return { session: null, isAuthenticated: false, isLoading: false, error: null, signIn: vi.fn(), isSigningIn: false, signInError: null, ...overrides };
    }

    const expired: LaunchStage = { status: "error", error: { kind: "session", details: "AuthError: expired" } };

    function gate(value: AuthContextValue, onRetry: () => void) {
        return (
            <AuthContext.Provider value={value}>
                <LaunchGate session={expired} docket={PENDING} onRetry={onRetry} />
            </AuthContext.Provider>
        );
    }

    it("loads again once, after the user signs in from this screen", () => {
        const onRetry = vi.fn();
        const signIn = vi.fn();
        const { rerender } = render(gate(auth({ signIn, isAuthenticated: true }), onRetry));

        fireEvent.click(screen.getByRole("button", { name: "Sign in with Fabric" }));
        expect(signIn).toHaveBeenCalledTimes(1);
        rerender(gate(auth({ signIn, isAuthenticated: true, isSigningIn: true }), onRetry));
        expect(onRetry).not.toHaveBeenCalled();
        rerender(gate(auth({ signIn, isAuthenticated: true, isSigningIn: false }), onRetry));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("does not reload by itself when it appears while a sign-in started elsewhere is finishing", () => {
        const onRetry = vi.fn();
        const { rerender } = render(gate(auth({ isAuthenticated: true, isSigningIn: true }), onRetry));
        rerender(gate(auth({ isAuthenticated: true, isSigningIn: false }), onRetry));
        expect(onRetry).not.toHaveBeenCalled();
    });
});
