# Backlog

Ideas that are not scheduled. Nothing here is built.

## Same question in English and Spanish, to compare accuracy by language

Questions are never translated (the question is sent to the agent exactly as written). To measure whether the agent is
as accurate in Spanish as in English, a team could propose the same question twice, once per language, as two separate
cases. Hearings would then report the verdicts per language.

Needs: a `Case.language` field (see below), a way to link the two cases as a pair, and a per-language view of the
verdicts. Not before the language badge exists.

## Case language (`Case.language`) — needs approval, schema change

Proposal (minimal): an optional text field on `Case`, `@text({ max: 5, optional: true }) language?: string`, filled
from the UI language at creation (`en` | `es`). Older cases stay empty and show no badge. It goes to TEST first, and to
production before the code that writes it (same order as `VerdictReview`). The badge (ES / EN) would then appear next
to the question in lists, the case page, hearings and the ticker.
