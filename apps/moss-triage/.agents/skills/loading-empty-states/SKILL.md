---
name: loading-empty-states
description: "Handle every state of async data: loading, empty, error and success. Use when fetching or saving data, showing lists, or adding retries, skeletons or optimistic updates. Triggers: loading, spinner, skeleton, empty state, error state, retry, placeholder, no data, fetching, async, optimistic update, offline, saving"
metadata:
  author: Fabricator
  version: 2.0.0
---
# Loading & empty states

Design every data-driven view for all of its states, not only the happy path.

## The four states
- **Loading:** skeletons shaped like the content for pages and lists; a small spinner only for short local waits, such as inside a button. Wait about 300ms before showing a loader so fast responses don't flicker.
- **Empty:** say what will appear here and offer the first action. Tell "nothing yet" apart from "no results for this filter", and offer to clear the filter.
- **Error:** say what failed in plain words, keep whatever already loaded on screen, and offer "Try again". Details go to the console, not the user.
- **Success:** show the result in place, with a brief confirmation only when the change isn't visible.

## Saving
- While a save is in flight, disable its button and show progress ("Saving…") so nothing is sent twice.
- Use optimistic updates for quick, reversible actions such as toggling, renaming or reordering, and roll back with a message if the save fails.
- Keep what the user typed when a save fails.

## Rayfin data
- Reads and writes can fail when a session expires or the connection drops, so handle errors on every call.
- A collection read returns one page (100 records by default). Lists that can grow page through their results, as the `rayfin` skill describes, so they're never silently cut short.

## Before you finish
- Review each view that loads or saves data: loading, empty, error and success are all covered, and no button can be pressed twice while saving.
