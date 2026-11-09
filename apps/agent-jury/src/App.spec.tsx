//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { VisualTheme } from "@microsoft/fabric-visuals-core";
import App from "@/App";
import { ThemeContext } from "@/hooks/theme.context";
import { initI18n } from "@/i18n/i18n";

vi.mock("@/lib/rayfin-client", () => ({
    getRayfinClient: () => {
        throw new Error("Missing required env vars for creating rayfin client");
    },
}));

function renderApp() {
    return render(
        <ThemeContext.Provider value={{ isDark: false, toggleTheme: () => {}, theme: {} as VisualTheme }}>
            <App />
        </ThemeContext.Provider>,
    );
}

describe("App", () => {
    beforeAll(() => {
        initI18n("en");
    });

    it("renders the masthead with the language and theme toggles", () => {
        renderApp();
        expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    });

    it("shows an Objection instead of data when the app can't connect", () => {
        renderApp();
        expect(screen.getByRole("alert")).toHaveTextContent("Objection!");
    });
});
