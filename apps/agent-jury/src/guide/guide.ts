import { Marked } from "marked";
import enGuide from "../../docs/user-guide.md?raw";
import esGuide from "../../docs/user-guide.es.md?raw";
import type { AppLanguage } from "@/i18n/language-preference";

const SOURCES: Record<AppLanguage, string> = { en: enGuide, es: esGuide };

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The guide is bundled at build time (docs/user-guide*.md), so jurors never leave the app. Raw HTML in the
// markdown is escaped; links to other files in the repo are shown as plain text because they do not exist in the app.
const markdown = new Marked({
    gfm: true,
    renderer: {
        html({ text }) {
            return escapeHtml(text);
        },
        link({ href, title, tokens }) {
            const label = this.parser.parseInline(tokens);
            if (!/^https?:\/\//i.test(href)) return label;
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
            return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`;
        },
    },
});

/** Sentences for people reading the repository on GitHub (links to other files, the language switcher) are left out of the in-app guide. */
function withoutRepoOnly(source: string): string {
    return source.replace(/<!-- repo-only -->[\s\S]*?<!-- \/repo-only -->/g, "");
}

export function renderMarkdown(source: string): string {
    return markdown.parse(withoutRepoOnly(source), { async: false });
}

/** The user guide as HTML in the given language, without its first heading (the page has its own title). */
export function guideHtml(language: AppLanguage): string {
    return renderMarkdown(withoutRepoOnly(SOURCES[language]).replace(/^\s*# .*\r?\n/, ""));
}
