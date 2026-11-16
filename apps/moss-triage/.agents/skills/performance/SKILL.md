---
name: performance
description: "Keep the app fast to load and smooth to use as data and features grow. Use when the app feels slow, lists get long, pages load a lot of data, or when adding heavy libraries, images or charts. Triggers: performance, speed, fast, slow, bundle size, lazy load, code splitting, memoization, re-render, cache, debounce, throttle, virtualization, optimize, images"
metadata:
  author: Fabricator
  version: 2.0.0
---
# Fast & snappy

Fast apps load little, fetch little and render little.

## Loading
- Split code by route, and lazy-load heavy or rarely used parts (editors, charts, maps, dialogs) with dynamic `import()` and `React.lazy`.
- Weigh what a new dependency adds before installing it. Prefer small libraries or what the platform offers (`Intl`, `fetch`, CSS).
- Size images for where they're shown, use modern formats, lazy-load images below the fold, and set width and height to prevent layout shifts.

## Data
- Fetch only the fields and records a view needs, filtering and sorting in the query. Page through long lists instead of loading everything.
- Run independent requests in parallel, reuse data you already have, and refresh in the background where that's safe.
- Debounce search and other rapid input (about 300ms), and throttle scroll and resize handlers.

## Rendering
- Keep state close to where it's used so updates re-render less. Memoize expensive calculations and callbacks passed to large lists.
- Virtualize lists and tables longer than a few hundred rows.
- Prefer CSS for animation and layout over measuring elements in JavaScript.

## Avoid
- One request per row, chains of requests that wait on each other, and work during render that could happen once.

## Before you finish
- Review your changes for the biggest costs first: the number and size of requests, what's added to the bundle, and how many items render at once.
