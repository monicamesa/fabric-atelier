/** The theme before React renders: the host's appearance, an existing .dark class, else prefers-color-scheme. */
export function isDarkAtStart(): boolean {
    const appearance = document.documentElement.getAttribute("data-appearance");
    if (appearance === "dark") return true;
    if (appearance === "light") return false;

    if (document.documentElement.classList.contains("dark")) return true;

    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Sets the theme attributes at once, so the launch screen's first paint already has the right tokens. */
export function applyThemeAtStart(): void {
    const dark = isDarkAtStart();
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
}
