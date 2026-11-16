---
name: search-and-filter
description: "Help people find records in long lists with search, filters, sorting and paging. Use when building lists, tables, directories or any screen with more than a handful of records. Triggers: search, filter, sort, sorting, list, table, data grid, pagination, paging, load more, infinite scroll, find, lookup, facets"
metadata:
  author: Fabricator
  version: 1.0.0
---
# Search, sort & filter

Long lists need a fast way to find things. Do the work in the query, not in the browser.

## Search and filters
- Put a search box above any list that can grow past about 20 items. Wait about 300ms after typing stops before querying (debounce), and keep the previous results on screen until new ones arrive.
- Offer filters only for the fields people actually narrow by, such as status, owner or a date range. Show active filters as removable chips with "Clear all".
- Filter and sort in the Rayfin query with `where` and `orderBy`, so results are correct across every page.
- Keep the search, filters, sort and page in the URL, so a view can be shared and survives a reload.

## Sorting
- Default to the most useful order, often newest first or due soonest. Let people sort table columns, and show the current sort and its direction.
- Keep the order stable (add `id` as a tie-breaker) so paging never skips or repeats records.

## Paging
- A Rayfin collection read returns one page (100 records by default). Page with `first`, `after` and `executePaginated`, as the `rayfin` skill describes, behind "Load more" or infinite scroll.
- Don't promise totals you don't have. There's no `count()`, so say "Showing 50" rather than "50 of 1,204".

## Results
- Highlight what matched and keep the number shown visible. "No results" gets its own message with a way to clear the search.

## Before you finish
- Review: searching and filtering never download the whole table, the URL restores the same view, and an empty result explains how to widen the search.
