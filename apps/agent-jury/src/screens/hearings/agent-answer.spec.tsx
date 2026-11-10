import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentAnswer } from "./agent-answer";

describe("AgentAnswer", () => {
    it("turns **text** into <strong> and nothing else", () => {
        const { container } = render(<AgentAnswer text="Revenue was **2,183,973.48** in 2026 and **more**." />);
        const strong = container.querySelectorAll("strong");
        expect([...strong].map((element) => element.textContent)).toEqual(["2,183,973.48", "more"]);
        expect(container.querySelector("p")?.textContent).toBe("Revenue was 2,183,973.48 in 2026 and more.");
    });

    it("shows HTML in an answer as literal text, never as elements", () => {
        const hostile = `<script>window.__pwned = true</script><img src=x onerror="window.__pwned = true"> **bold <b>x</b>** <a href="javascript:alert(1)">link</a>`;
        const { container } = render(<AgentAnswer text={hostile} />);
        expect(container.querySelector("script, img, a, b")).toBeNull();
        expect(container.querySelector("strong")?.textContent).toBe("bold <b>x</b>");
        expect(container.querySelector("p")?.textContent).toBe(hostile.replace(/\*\*/g, ""));
        expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("leaves an unmatched marker alone", () => {
        const { container } = render(<AgentAnswer text="Revenue **open" />);
        expect(container.querySelector("strong")).toBeNull();
        expect(container.textContent).toBe("Revenue **open");
    });
});
