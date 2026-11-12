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

    it("starts with the launch screen, not the masthead or the small page loader", () => {
        renderApp();
        expect(screen.getByRole("img", { name: "Gavel" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
        expect(screen.queryByText("The jury is deliberating…")).not.toBeInTheDocument();
    });

    it("shows an Objection inside the launch screen, with Try again, when the app can't connect", () => {
        renderApp();
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent("Objection!");
        expect(alert).toHaveTextContent("Missing required env vars");
        expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    });
});
