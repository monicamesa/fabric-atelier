import type { DocketCase } from "./docket";
import type { TestimonyRow } from "./cases.service";

/** Quality Lab ground-truth CSV: exactly these columns, in this order. */
export const CASE_LAW_HEADER = ["question", "expected_answer", "category", "tags"] as const;

export interface CaseLawRow {
    question: string;
    expected_answer: string;
    category: string;
    tags: string;
}

const EXAMPLE_PREFIX = "example-";

/** Demo and example data (jurors from seed.sql, "example-" user ids, example.com addresses) never leaves the app. */
export function isExampleAuthor(author: { authorUserId: string; authorEmail: string }): boolean {
    return author.authorUserId.toLowerCase().startsWith(EXAMPLE_PREFIX) || author.authorEmail.trim().toLowerCase().endsWith("@example.com");
}

const tidy = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** Tags are separated by ";" inside the cell, so a ";" or "," inside a tag is replaced by a space. */
const tagText = (value: string) => tidy(value).replace(/[;,]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Tags = the case's own tags (typed separated by commas) followed by the ruling answer's structured definition, each as
 * "label: value" (criterion, time window, population, source). Nothing else: no authors, emails or ids.
 */
export function caseLawTags(caseTags: string | null | undefined, ruling: TestimonyRow): string {
    const tags = new Map<string, string>();
    const add = (value: string) => {
        const clean = tagText(value);
        if (clean && !tags.has(clean.toLowerCase())) tags.set(clean.toLowerCase(), clean);
    };
    for (const tag of (caseTags ?? "").split(/[,;]/)) add(tag);
    const defined: [string, string | null | undefined][] = [
        ["criterion", ruling.criterion],
        ["time window", ruling.timeWindow],
        ["population", ruling.population],
        ["source", ruling.source],
    ];
    for (const [label, value] of defined) if (tidy(value)) add(`${label}: ${tagText(value ?? "")}`);
    return [...tags.values()].join(";");
}

/**
 * The ruled cases of one agent that may be exported: ruled now (a case reopened by an approver is under review, R9, and
 * stays out until the jury rules again), verified (R7), not dismissed, and not example data. Newest ruling first.
 */
export function buildCaseLaw(cases: readonly DocketCase[]): CaseLawRow[] {
    const rows: { row: CaseLawRow; at: string }[] = [];
    for (const item of cases) {
        const { analysis, record } = item;
        if (analysis.state !== "ruled" || !analysis.verified) continue;
        const ruling = item.testimonies.find((testimony) => testimony.id === analysis.rulingTestimonyId);
        if (!ruling) continue;
        if (isExampleAuthor(record) || isExampleAuthor(ruling)) continue;
        rows.push({
            at: new Date(record.createdAt).toISOString(),
            row: {
                question: tidy(record.text),
                expected_answer: tidy(ruling.answer),
                category: tidy(record.category),
                tags: caseLawTags(record.tags, ruling),
            },
        });
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at)).map((entry) => entry.row);
}

/** A plain number cannot run as a formula in a spreadsheet, so "-5" or "+1.5" keep their value. */
const PLAIN_NUMBER = /^[+-]?\d+([.,]\d+)*%?$/;

/** CSV injection: a cell a spreadsheet would read as a formula gets a leading apostrophe. */
export function neutraliseFormula(cell: string): string {
    return /^[=+\-@\t\r]/.test(cell) && !PLAIN_NUMBER.test(cell) ? `'${cell}` : cell;
}

/** RFC 4180: quote a cell that has a quote, a comma or a line break, doubling the quotes inside. */
export function quoteCell(cell: string): string {
    return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

const BOM = "\uFEFF";

/** UTF-8 with a BOM (so Excel shows accents), CRLF line endings, a header row, and every cell neutralised then quoted. */
export function toCaseLawCsv(rows: readonly CaseLawRow[]): string {
    const line = (cells: readonly string[]) => cells.map((cell) => quoteCell(neutraliseFormula(cell))).join(",");
    const body = rows.map((row) => line(CASE_LAW_HEADER.map((column) => row[column])));
    return `${BOM}${[line(CASE_LAW_HEADER), ...body].join("\r\n")}\r\n`;
}

export function slugify(name: string): string {
    const slug = name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug || "agent";
}

const pad = (value: number) => String(value).padStart(2, "0");

/** agent-jury-<agent-name-slug>-case-law-<yyyy-mm-dd>.csv (the date is the local day of the export). */
export function caseLawFilename(agentName: string, date: Date): string {
    return `agent-jury-${slugify(agentName)}-case-law-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.csv`;
}
