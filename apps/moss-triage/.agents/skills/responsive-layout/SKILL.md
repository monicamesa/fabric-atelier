---
name: responsive-layout
description: "Make layouts adapt to every screen, from phones to wide desktops. Use when building page layouts, navigation, tables, grids or anything that has to fit a small screen. Triggers: responsive, mobile, tablet, desktop, breakpoint, media query, fluid, grid, flexbox, viewport, small screen, adapt, mobile-first, overflow"
metadata:
  author: Fabricator
  version: 2.0.0
---
# Responsive on every screen

Every screen should work from a 360px phone to a 1440px desktop and wider.

## Layout
- Build mobile-first: one column by default, with more columns added through `min-width` media queries or container queries.
- Use flexbox and grid with `fr`, `minmax()`, `auto-fit` and `clamp()` instead of fixed pixel widths. Cap content width on large screens so lines and cards don't stretch.
- Use the project's breakpoints. If it has none, use about 640, 1024 and 1280px.

## Content
- Nothing scrolls sideways: long words and URLs wrap, images and media use `max-width: 100%`, and wide tables scroll inside their own container or become stacked cards on phones.
- On small screens, fold secondary navigation into a menu and keep the main action in reach.
- Size text in `rem`, with body text at least 16px on phones.

## Touch
- Tap targets are at least 44 by 44px with space between them. Don't hide essential actions behind hover.
- Use the right input types (`email`, `tel`, `number`, `date`) so phones show the right keyboard.

## Before you finish
- Review each changed screen at 360, 768 and 1280px: no sideways scrolling, nothing clipped or overlapping, and the main action stays visible.
