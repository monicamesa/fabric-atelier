import type { TestimonyRow } from "@/data/cases.service";
import type { DocketCase } from "@/data/docket";
import type { CasesFilter } from "@/lib/route";
import type { CaseState } from "@/rules/case-validity";

/** D7: the server can't number cases, so the number is the first 4 characters of the id. */
export function caseNumber(id: string): string {
    return `#${id.slice(0, 4)}`;
}

const RANK: Record<CaseState, number> = { disputed: 1, under_review: 2, ruled: 3, dismissed: 4 };

/** Today's docket: cases waiting for my vote first, then open cases (disputed before under review), then the latest rulings. */
export function homeRows(cases: readonly DocketCase[], limit = 6): DocketCase[] {
    return cases
        .filter((item) => item.analysis.state !== "dismissed")
        .map((item, index) => ({ item, index }))
        .sort(
            (a, b) =>
                Number(b.item.needsMyVote) - Number(a.item.needsMyVote) || RANK[a.item.analysis.state] - RANK[b.item.analysis.state] || a.index - b.index,
        )
        .slice(0, limit)
        .map(({ item }) => item);
}

/** Accent- and case-insensitive search over the question, category and tags. */
export function matchesQuery(item: DocketCase, query: string): boolean {
    const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const needle = fold(query.trim());
    if (!needle) return true;
    return fold([item.record.text, item.record.category, item.record.tags ?? ""].join(" ")).includes(needle);
}

export function applyFilter(cases: readonly DocketCase[], filter: CasesFilter, query: string): DocketCase[] {
    return cases.filter((item) => matchesQuery(item, query) && (filter === "all" || (filter === "vote" ? item.needsMyVote : item.proposedByMe)));
}

export const DIFF_ROWS = ["criterion", "timeWindow", "population", "source"] as const;
export type DiffKey = (typeof DIFF_ROWS)[number];

const hasDetails = (testimony: TestimonyRow) => DIFF_ROWS.some((key) => testimony[key]?.trim());
const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/** D3: the table needs the structured details on both answers; otherwise the definitions go side by side. */
export function canDiff(a: TestimonyRow, b: TestimonyRow): boolean {
    return hasDetails(a) && hasDetails(b);
}

export function differingRows(a: TestimonyRow, b: TestimonyRow): DiffKey[] {
    return DIFF_ROWS.filter((key) => !same(a[key], b[key]));
}
