---
name: buttery-animations
description: "Add smooth, purposeful motion and micro-interactions. Use when adding transitions or hover and press feedback, or when animating content that appears, changes or leaves. Triggers: animation, transition, motion, animate, hover effect, fade, slide, spring, easing, micro-interaction, smooth, 60fps, framer motion, reduced motion"
metadata:
  author: Fabricator
  version: 2.0.0
---
# Buttery animations

Use motion to show what changed. Never use it to decorate or to make people wait.

## When to animate
- Things that enter, leave or move: dialogs, menus, toasts, list items being added or removed, panels expanding.
- Feedback on direct interaction: hover, press, toggle, drag.
- Skip motion for whole pages, actions people repeat all the time, and anything that would delay reading or typing.

## How
- Animate only `transform` and `opacity`. Don't animate `width`, `height`, `top`, `left` or large shadows.
- Durations: 100 to 150ms for hover and press, 150 to 250ms for small elements entering, up to 300ms for large panels. Exits are a little faster than entrances.
- Easing: ease-out (for example `cubic-bezier(0.2, 0, 0, 1)`) for entrances, ease-in for exits, ease-in-out for moves.
- Move short distances (4 to 16px) while fading. Stagger list items by 20 to 40ms and cap the total stagger.
- Use CSS transitions for simple state changes. Use an animation library only if the project already has one or layout animations really need it.

## Respect the user
- Honor `prefers-reduced-motion: reduce`: swap movement for a fade, or no animation.
- Never block input while something animates, and never loop motion nobody asked for.

## Before you finish
- Review each animation: it has a clear reason, takes 300ms or less, moves only transform or opacity, and has a reduced-motion fallback.
