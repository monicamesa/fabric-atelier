import type { PagedResult } from "@microsoft/rayfin-data";

export const PAGE_SIZE = 100;

/** Follows the cursor until the last page; `.execute()` alone stops silently at one page. */
export async function readAllPages<T>(fetchPage: (after: string | undefined) => Promise<PagedResult<T>>): Promise<T[]> {
    const items: T[] = [];
    let after: string | undefined;
    for (;;) {
        const page = await fetchPage(after);
        items.push(...page.items);
        if (!page.hasNextPage || !page.endCursor) {
            return items;
        }
        after = page.endCursor;
    }
}
