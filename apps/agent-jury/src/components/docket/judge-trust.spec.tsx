import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { i18n, initI18n } from "@/i18n/i18n";
import type { JudgeTrust, TrustCounts, VersionTrust } from "@/rules/judge-trust";
import { JudgeTrustLine, JudgeTrustPanel } from "./judge-trust";

const counts = (agreed: number, disagreed: number, extra: Partial<TrustCounts> = {}): TrustCounts => ({
    agreed,
    disagreed,
    decided: agreed + disagreed,
    pending: 0,
    excluded: 0,
    unreviewed: 0,
    percent: agreed + disagreed > 0 ? Math.round((agreed / (agreed + disagreed)) * 100) : null,
    showPercent: agreed + disagreed >= 5,
    ...extra,
});
const version = (name: string, current: boolean, c: TrustCounts): VersionTrust => ({ version: name, current, ...c });
const trust = (current: VersionTrust, history: VersionTrust[] = []): JudgeTrust => ({ current, history, byHearing: {}, overruled: [] });

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("judge trust on Home", () => {
    it("says so, and invents no number, when nothing has been reviewed", () => {
        render(<JudgeTrustPanel trust={trust(version("default", true, counts(0, 0)))} />);
        expect(screen.getByTestId("trust-headline")).toHaveTextContent("—");
        expect(screen.getByText(/Shown after the first hearings/)).toBeInTheDocument();
    });

    it("shows 'n of m' before there are enough decided verdicts", () => {
        render(<JudgeTrustPanel trust={trust(version("default", true, counts(3, 1, { pending: 1 })))} />);
        expect(screen.getByTestId("trust-headline")).toHaveTextContent("3 of 4");
        expect(screen.getByText(/The jury agreed with the judge on 3 of 4 reviewed verdicts\./)).toBeInTheDocument();
        expect(screen.getByText(/1 split verdict is not counted yet/)).toBeInTheDocument();
    });

    it("shows the percentage from the minimum number of decided verdicts", () => {
        render(<JudgeTrustPanel trust={trust(version("v2", true, counts(4, 1)))} />);
        expect(screen.getByTestId("trust-headline")).toHaveTextContent("80%");
    });

    it("shows the current prompt version prominently and earlier ones as history", () => {
        render(<JudgeTrustPanel trust={trust(version("v2", true, counts(3, 1)), [version("default", false, counts(1, 1))])} />);
        expect(screen.getByText("Judge prompt: v2")).toBeInTheDocument();
        const history = screen.getByText("Earlier judge prompts").closest("details")!;
        expect(history).not.toHaveAttribute("open");
        expect(history).toHaveTextContent("default");
        expect(history).toHaveTextContent("1 of 2");
    });

    it("has a compact phone line with the same numbers", () => {
        const { container } = render(<JudgeTrustLine trust={trust(version("v2", true, counts(3, 1)))} />);
        expect(container.textContent).toContain("3 of 4");
        expect(container.textContent).toContain("Judge prompt: v2");
    });
});
