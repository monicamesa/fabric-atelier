# Agent Jury — Design guide ("The Docket")

Status: approved direction, v1 (2026-11-09).
Reference mockups: `docs/design/mockups/*.html` (static HTML, open in a browser; `{{ … }}` placeholders and `support.js` belong to the mockup tool and must not be copied into the app).

Agent Jury looks like a **court newspaper**: paper, ink, big serif headlines, thin rules, stamps. It must feel like a community tool made to learn and share, never like a generic SaaS dashboard.

---

## 1. Principles

1. **Explain, don't assume.** Every page has one plain-language line under its title. Court words (case, ruling, hearing, appeal) always appear with their meaning nearby (glossary on Home, helper lines elsewhere).
2. **One next step per item.** Every open case shows the action it needs ("Cast your vote", "Settle the dispute"). Closed cases show the result, not a button.
3. **Truth is computed, never edited.** The UI never offers "edit" on votes, testimonies or the court record. It shows history.
4. **No fake data.** Loading shows skeletons; errors show "Objection!". Sample data only in demo mode, always with a visible band.
5. **Motion has meaning.** The gavel strikes when something is ruled, stamps land on verdicts. Nothing moves just to decorate. Respect `prefers-reduced-motion`.

---

## 2. Design tokens

Define them as CSS custom properties on `:root` and override them under `[data-theme="dark"]`. Components use only tokens, never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F3EEE4` | `#14110D` | Page background |
| `--paper-raised` | `#FFFDF8` | `#1B1712` | Cards, inputs, tables |
| `--paper-hover` | `#EBE4D6` | `#221D16` | Row hover |
| `--ink` | `#14110D` | `#F3EEE4` | Headlines, borders, primary button |
| `--ink-inverse` | `#F3EEE4` | `#14110D` | Text on `--ink` |
| `--text` | `#2E2820` | `#E6DED0` | Body text |
| `--text-muted` | `#4A4235` | `#BDB3A2` | Helper text, metadata |
| `--rule` | `#D5CBB8` | `#3A332A` | Thin separators |
| `--track` | `#E2D9C8` | `#3A332A` | Progress bar tracks |
| `--ruled` | `#0F6E5C` | `#7FE0C4` (text) / `#0F6E5C` (fill) | Ruled, case law, links |
| `--action` | `#C8502B` | `#C8502B` | Primary-button shadow, dispute borders, filled dispute button |
| `--action-text` | `#A8401F` | `#FF8A62` | Coral text (small text must use this, not `--action`) |
| `--dispute-bg` | `#FFF4EC` | `#2A1A12` | Disputed card / error background |
| `--dispute-text` | `#8A3414` | `#FFB59A` | Text on `--dispute-bg` |
| `--review` | `#4B6B8F` | `#A9B8D6` | Under review (border/bar) |
| `--review-text` | `#3D5A7A` | `#A9B8D6` | Under review (text) |
| `--overruled` | `#FFD27A` | `#FFD27A` | "Judge overruled" chip (text always `#14110D`) |
| `--ticker-bg` | `#14110D` | `#0A0806` | Verdict ticker |
| `--focus` | `#0F6E5C` | `#7FE0C4` | Focus outline |

Contrast: all text pairs above meet WCAG AA (4.5:1) at the sizes used. Don't introduce new colours without checking contrast.

**Status colours are a system; keep them consistent everywhere:**

| State (`case.status`) | Label EN / ES | Colour |
|---|---|---|
| `under_review` | UNDER REVIEW / EN REVISIÓN | `--review` |
| `disputed` | DISPUTED / EN DISPUTA | `--action` |
| `ruled` | RULED / FALLADO | `--ruled` |
| `dismissed` | DISMISSED / DESESTIMADO | muted, dashed border, struck-through question |
| appeal won (on a verdict) | JUDGE OVERRULED / JUEZ CORREGIDO | `--overruled` |

Never use colour alone: every status also has its text label.

---

## 3. Typography

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Hero headline | Fraunces | 112–132 px / 900, line-height 0.88, letter-spacing −0.045em | Home and Intro only |
| Page title | Fraunces | 56–64 px / 900 | One per page |
| Section title | Fraunces | 24–30 px / 700 | |
| Case question | Fraunces | 19–21 px / 700 (lists), 56 px / 900 (detail) | Questions are always serif |
| Big number | Fraunces | 40–92 px / 900 | Judge trust, scores, answers |
| UI text, buttons | Inter | 15–17 px / 400–700 | Base 16 px |
| Kicker / eyebrow | Inter | 12–13 px / 700, uppercase, letter-spacing 0.12–0.16em | Coral (`--action-text`) |
| Case numbers, IDs, tech | JetBrains Mono | 13–15 px / 500 | `#015`, ticker, query timings |

Load fonts from npm (`@fontsource-variable/fraunces`, `@fontsource-variable/inter`, `@fontsource/jetbrains-mono`) and bundle them, so the app doesn't depend on Google Fonts at runtime.

---

## 4. Layout

- Max content width 1360 px, side padding 24 px (16 px on phones).
- **Square corners everywhere** (radius 0). Only avatars and the live dot are round.
- Structure with **rules, not shadows**: 1 px `--ink` under the masthead and section titles, 1 px `--rule` between rows, **6 px double `--ink`** under the hero or page header (the "newspaper" rule).
- Columns are separated by a 1 px `--rule` vertical line, not by gaps between cards.
- Responsive: multi-column grids collapse to one column below 900 px. The ticker stays; the glossary becomes 2×2.

---

## 5. Components

**Masthead** — wordmark "Agent Jury" (Fraunces 900, 22 px) · nav (Home, Cases, Hearings, Case law, How it works) with a coral 2 px underline on the current page (`aria-current="page"`) · EN/ES segmented buttons (`aria-pressed`) · theme button with an `aria-label`.

**Verdict ticker** (Home only) — fixed coral label "LATEST VERDICTS" + scrolling list, monospace 14 px, plain words ("all 3 jurors agree", not "3–0"). Pauses on hover and focus; static under reduced motion. Data comes from the latest case and verdict events.

**Buttons**
- Primary: `--ink` background, `--ink-inverse` text, 700, min-height 52 px (44 px when compact), `box-shadow: 5px 5px 0 var(--action)`.
- Secondary: transparent, 2 px `--ink` border.
- Dispute action: `--action` background, white text ("Settle the dispute").
- Text link action: `--action-text`, 700, with "→".
- One primary per view. Minimum touch target 44 px.

**Status chip** — uppercase 12 px, 700, letter-spacing 0.1em, 2 px border (open states) or filled (ruled, overruled). No rotation.

**Docket row** (Home) — grid `64px | 1fr | 210px`: case number (mono) · question (Fraunces) with a helper line (why it's in this state) · status chip + next-step button. Column headers above ("Case · Question · Status · next step").

**Case clipping** (Cases board) — `--paper-raised`, 1 px `--ink` border, hover lifts with `4px 4px 0 var(--ink)`. Disputed clippings use `--dispute-bg` and a 2 px `--action` border. Each column has a title, a count and a one-line meaning ("Needs votes from the jury").

**Testimony card** — label "ANSWER A · NAME, TEAM", the value as a big Fraunces number, the definition in one sentence, a vote bar and "Vote for answer A".

**Definition diff table** — "Where the definitions part ways": rows where the answers differ are highlighted with `--dispute-bg`.

**Admin table** — `--paper-raised` table with a 1 px `--ink` border, uppercase column headers, avatar + name + email (mono) per row, role chip (ADMIN filled ink, JUROR outlined), row actions on the right ("Make admin", "Deactivate" in `--action-text`). Admins can't deactivate themselves. Nobody is deleted: deactivated jurors keep their record. Every admin change shows in the admin log, including rejected attempts.

**Court record** — read-only timeline (time · event), with the note "The record is never edited".

**Judge trust stat** — label, big %, one sentence that explains it ("agreed in 5 of 6 recent rulings"), and a link to the appeals.

**Glossary strip** — 4 columns: Case, Ruling, Hearing, Appeal. Shown on Home, and repeated in How it works.

**Story card** — `--ink` block with a kicker, a Fraunces headline, two lines and a stamp ("OVERRULED"). Content is generated from the latest won appeal; hide the card if there is none.

**Stamp** — thick border, Fraunces 900, rotated −10 to −14°, animated in (scale 2.2 → 1). Used for CORRECT / INCORRECT / OVERRULED only.

**Gavel** — inline SVG; the head strikes (rotate −34° → 9° → 0). Loops only on loading and intro; elsewhere it plays once when a case is ruled.

---

## 6. States

| State | Pattern |
|---|---|
| Loading a page | Gavel + rotating line ("The jury is deliberating…", "Counting votes…"), skeletons with the exact shape of the content |
| Long work (hearing) | Dark panel "IN SESSION", step list (✓ done · ● now · ○ next), progress bar, time estimate, "You can leave" + link |
| Error | `role="alert"` block: "Objection!" + what happened + "Your cases are safe" + Try again / Copy details + collapsible technical details |
| Empty | Short explanation + the one action that fills it (e.g. "No cases yet. Propose the first question your agent should answer.") |
| Demo mode | Full-width band at the top: "Demo data — nothing here is real" |

---

## 7. Motion

| Animation | Duration | Where |
|---|---|---|
| Gavel strike | 2.4–2.8 s (loop) / once | Loading, intro / on ruling |
| Stamp in | ~0.5 s | Verdicts, story card |
| Highlight underline draws in | 1 s | Hero headline |
| Intro step change | 0.55 s rise | Intro |
| Ticker | 48 s per loop | Home |
| Clipping hover lift | 0.15 s | Cards |
| Page → detail | View Transitions API (morph the question) | Docket row → case detail |

All of these are disabled under `@media (prefers-reduced-motion: reduce)`.

---

## 8. Copy and i18n

- English is the default; Spanish via the EN/ES toggle. All strings are i18n keys; nothing is hardcoded.
- Write short sentences in plain business language. Court words are fine as long as they are explained once.
- Use numbers in words where they help: "all 3 jurors agree", "5 of 6".

| Key concept | EN | ES |
|---|---|---|
| Judge | Judge | Juez |
| Jury / juror | Jury / juror | Jurado / jurado |
| Defendant (agent) | Agent (on the stand) | Agente (en el estrado) |
| Case | Case | Caso |
| Testimony (expected answer) | Answer / testimony | Respuesta / testimonio |
| Ruling | Ruling / ruled | Fallo / fallado |
| Dispute | Dispute / disputed | Disputa / en disputa |
| Appeal | Appeal | Recurso |
| Case law | Case law | Jurisprudencia |
| Hearing | Hearing | Vista |
| Judge trust | Judge trust | Confianza en el juez |
| Overruled | Judge overruled | Juez corregido |

---

## 9. Accessibility checklist

- Text contrast AA; small coral text uses `--action-text`.
- Visible focus: `outline: 3px solid var(--focus); outline-offset: 3px`.
- Real `<button>`s and `<a>`s; toggles use `aria-pressed`; nav uses `aria-current`.
- Live regions: loading `role="status"`, errors `role="alert"`, progress `role="progressbar"` with values.
- Keyboard on the live hearing: A agree · X appeal · J/K previous/next · ? help (show the keys on screen).
- Status never by colour alone.
- Reduced motion respected.

---

## 10. Screens and mockups

| # | Screen | Mockup file | Iteration |
|---|---|---|---|
| 1 | Home (docket, judge trust, glossary, ticker) | `home.html` | I1 |
| 1b | Home — dark, Spanish | `home-dark-es.html` | I1 |
| 2 | Cases (board by status) | `cases.html` | I1 |
| 3 | Case detail (dispute, diff, court record) | `case-detail.html` | I1–I2 |
| 4 | Intro (3 steps, shown once) | `intro.html` | I2 |
| 5 | Loading / long work / error | `states.html` | I1 (patterns) |
| 6 | Live hearing | `live-hearing.html` | I3+ |
| 7 | Admin "Clerk's office" (jurors, agents, admin log) | `admin.html` | I1b |

Sample data in the mockups (names, numbers, products) is illustrative only.

---

## 11. Don'ts

- No rounded cards, gradients, glassmorphism or drop shadows other than the coral offset on the primary button and the hover lift.
- No new accent colours. Four status colours + coral, that's the palette.
- No spinner without words. No sample data outside demo mode.
- No edit buttons on votes, testimonies or the record.
- Don't put more than one primary button in a view.
