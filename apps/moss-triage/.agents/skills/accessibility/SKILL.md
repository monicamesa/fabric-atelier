---
name: accessibility
description: "Make the app usable by everyone, including keyboard and screen-reader users. Use when building any UI, especially forms, dialogs, menus, custom controls, icons, images and color choices. Triggers: accessibility, a11y, screen reader, keyboard, focus, aria, contrast, WCAG, semantic HTML, alt text, tab order, accessible, color blind"
metadata:
  author: Fabricator
  version: 2.0.0
---
# Accessible to everyone

Aim for WCAG 2.2 AA. Most of it comes from using the right HTML.

## Structure
- Use semantic elements: `button` for actions, `a` for navigation, `nav`, `main`, `header` and `footer` for regions, and real lists and tables.
- One `h1` per page, with headings in order. Set the page `lang` and a meaningful title.

## Keyboard
- Everything that works with a mouse works with a keyboard, in a logical tab order. Never remove focus outlines without a clear `:focus-visible` style.
- Dialogs move focus inside, keep it there, close on Escape and return focus to what opened them. Menus and tabs support the arrow keys.
- Add a "Skip to content" link when navigation comes before the main content.

## Screen readers
- Every input has a label, every icon-only button has an `aria-label`, and meaningful images have `alt` text (decorative ones use `alt=""`).
- Announce changes that happen out of view (saved, failed, results updated) through an `aria-live` region.
- Prefer native elements to ARIA. A custom control needs the right role, name and state (`aria-expanded`, `aria-selected`, `aria-checked`).

## Visuals
- Contrast of at least 4.5:1 for text, and 3:1 for large text, icons and input borders, in both themes.
- Never use color alone to carry meaning: add text or an icon.
- Text can grow to 200% without breaking the layout. Targets are at least 24 by 24px (44px on touch screens).
- Respect `prefers-reduced-motion`.

## Before you finish
- Review each changed screen: it can be completed with only a keyboard, every control has an accessible name, and status changes and errors are announced.
