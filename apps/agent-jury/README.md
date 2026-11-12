English · [Español](README.es.md)

# Agent Jury

> **Who judges the judge?**

Agent Jury is a Microsoft Fabric App where business experts agree on the answers a Fabric Data Agent should give, and then check whether the LLM judge that evaluates the agent agrees with them. Experts propose test questions with the answer they expect, vote until they reach consensus, and correct the judge when it gets a verdict wrong. The agreed answers become reusable ground truth for the agent.

Developer docs (specification, iteration plans, design guide, conventions) are in English. The user-facing docs (this README, the user guide and the manual test script) are in English and Spanish.

![Home mockup](docs/design/images/mockup-home.png)

## Court vocabulary

The app uses a trial metaphor. Each term is also explained in the app.

| Term | Meaning |
|---|---|
| **Case** | A test question for an agent. |
| **Open for votes** | A case that is neither ruled nor disputed yet: jurors are still voting. |
| **Testimony** | An expected answer to a case, with the definition its author used. |
| **Ruling** | The jury agrees on one testimony: the case is *ruled*. |
| **Dispute** | Jurors back different answers, so the case is *disputed* until it is settled. |
| **Hearing** | An evaluation run of the agent against the ruled cases. |
| **Appeal** | A juror confirms or corrects the LLM judge's verdict on one case. |
| **Case law** | The ruled cases, exported as ground truth. |

## User guide

- [User guide](docs/user-guide.md) (EN) / [Guía de usuario](docs/user-guide.es.md) (ES): how to play, roles and the rules (when a case is ruled, disputes, hearings, reopening, judge trust). The Intro's last step and Home link to the in-app copy (`#guide`, rendered from these files at build time with `marked`), because jurors may not have access to the repository.
- Manual test script: [English](docs/manual-test.md) / [Español](docs/manual-test.es.md): end-to-end checklist for one person (Test A) and for an admin plus two jurors (Test B).
- **Start at Home, in "Your turn":** an editorial sidebar next to the headline, above Judge trust. It lists what needs the signed-in person now (votes, disputes, approver votes, judge verdicts to review and, for admins, ruled cases ready for a hearing), computed from data already loaded. Under the hero, "The game" index line (proposed · open for votes · ruled · in a hearing · reviewed) shows the bottleneck. Lists and the case page say what happens next for that person (`src/screens/docket/next-step.ts`, `your-turn.ts`, with tests).
- **Language of the content:** questions, answers and definitions are never translated, because the question is sent to the agent exactly as written. The language badge needs a schema change and waits for approval ([backlog](docs/iteraciones/backlog.md)).

## Status

In development, in use by a first group of jurors. Progress and next steps are tracked in [docs/iteraciones/estado.md](docs/iteraciones/estado.md) (Spanish, developer doc); the full specification is in [docs/especificacion-general.md](docs/especificacion-general.md).

**Works today**
- Jurors, agents, cases, answers (testimonies), votes, dismissals and the rules R1–R9 (ruling, disputes, reopening).
- The Clerk's office (admins): jurors, agents, admin log, example-data toggle.
- Home ("Your turn", "The game" line, ticker), the cases board and the case page with voting.
- Hearings: an admin launches an evaluation of the agent; the AI judge gives a verdict per case and jurors review it.
- Judge trust per agent and per critic-prompt version, and the case law CSV export.
- English and Spanish, light and dark themes, a launch screen, a three-step Intro and the in-app user guide. See [Launch screen and Intro](#launch-screen-and-intro).

**Next:** see the backlog and iteration plans in `docs/iteraciones/` (for example, showing how the agent reached its answer: [I4 trace spike](docs/iteraciones/I4-trace-spike.md)).

## Requirements

- A Microsoft Fabric capacity, F2 or higher, in a region where Fabric Apps is available, with the Fabric Apps workload enabled in the tenant. Data Agents and their evaluation need a paid capacity (not trial) and Data Agents enabled in the tenant.
- A workspace on that capacity where you are Contributor, Member or Admin.
- Node.js 20, 22 or 24, and Git.
- The Rayfin CLI. It is a dev dependency of this app (`@microsoft/rayfin-cli` 1.36.2), so `npx rayfin` uses the pinned version.

## Setup

Run every command from `apps/agent-jury` unless noted.

1. Clone the repository and install dependencies:

   ```powershell
   git clone <this repository>
   cd fabric-atelier/apps/agent-jury
   npm ci
   ```

2. From the repository root, copy `private.example.env` to `.private/values.env` and fill it in. The file is ignored by Git, and the pre-commit hook uses it to block private values (see the [root README](../../README.md)).
3. Sign in to Fabric:

   ```powershell
   npx rayfin login
   ```

4. Deploy the app (database, Functions and static site) to your workspace:

   ```powershell
   npx rayfin up --workspace "<your workspace name>"
   git restore rayfin/rayfin.yml
   ```

   `rayfin up` adds the deployed app URL to `rayfin/rayfin.yml`. Restore the file after **every** deploy so your tenant's URL is never committed.

5. Find the app's SQL database and store its server and name in `.private/values.env`:

   ```powershell
   node scripts/find-app-sql-database.mjs
   ```

6. Make yourself the first admin (the email is read from `.private/values.env`), then load the example jurors and agents:

   ```powershell
   node scripts/run-sql.mjs rayfin/seed/admin.sql --var AdminEmail=ACCOUNT_EMAIL
   node scripts/run-sql.mjs rayfin/seed/seed.sql
   ```

7. Run locally against the deployed backend:

   ```powershell
   npm run dev
   ```

Other commands: `npm test` (unit tests), `npm run lint`, `npm run build`.

### Test deployment

The deployed checks run against a second copy of the app in its own workspace, never against production. Its ids live in `.private/values.env` (keys ending in `_TEST`, see `private.example.env`) and in `rayfin/.env.test` (git-ignored).

```powershell
node scripts/deploy-test.mjs --set-secrets    # deploy to the test workspace, then switch back to production
node scripts/run-sql.mjs rayfin/seed/seed.sql --target=test
node scripts/run-sql.mjs rayfin/seed/docket-examples.sql --target=test   # one example case per state (test only)
node scripts/i1a-checks.mjs --expect-admin
node scripts/i1b-checks.mjs
node scripts/i1c-checks.mjs
```

The check scripts target the test deployment by default and refuse production unless called with `--target=production --allow-production`. SQL files marked `-- target: test-only` refuse to run without `--target=test`. The test build shows example agents and jurors by default (`VITE_SHOW_EXAMPLE_AGENTS=1`, set by `deploy-test.mjs`); in production they are hidden unless an admin turns on "Show example data" in the Clerk's office (nothing is deleted, and the choice resets on reload).

### Production deploy checklist

One production deploy per finished block of work. UI-only changes are verified locally (tests, `tsc`, lint, port 5180) and then go straight to production; schema, Functions or notebook changes go to the test deployment first.

1. Tests, `tsc` and lint pass; the work is committed (hooks pass) and pushed to `main`. `deploy-production.mjs` refuses unless the tree is clean and `HEAD` is `origin/main`.
2. **Schema first, or together with the code:** the `UserFlag` entity (per-user flags such as `intro_seen`) must exist in production before, or in the same deploy as, the code that reads it. The app tolerates a missing entity (the Intro counts as seen), but it would never show the Intro or remember it. The same goes for **`VerdictReview`** (and the `Hearing.criticPromptVersion` column) with the I3b code: apply the schema (`npx rayfin up db apply`) before or with that deploy. Home tolerates a missing review/verdict query (the judge-trust line and the judge items of the ticker hide), but appeals, R9 and judge trust do nothing without it.
3. `node scripts/deploy-production.mjs --allow-production` (add `--set-secrets` only when secrets change). It runs the full `rayfin up` (schema included) and then restores `rayfin/rayfin.yml`.
4. Minimal check: launch, Intro the first time and Home on reload, Hearings loads, no console errors. No hearings are launched and nothing polls.
5. Never commit tenant, workspace or item ids, emails or app URLs (they live in `.private/values.env`).

## Launch screen and Intro

- **The launch screen** ([design guide 6b](docs/design/design-guide.md)) is the first thing rendered and stays until the session and the initial data load are done. Its three steps are real work, not timers: **Session** (Fabric sign-in and the juror record), **Docket** (the parallel initial load) and **All rise**. It stays at least about 800 ms (no flash), holds "All rise" for about 600 ms, and after about 8 s shows "taking longer than usual" with Try again. Nothing retries by itself: a retry happens only when the user clicks. Errors appear inside it as an "Objection!" alert: expired session (sign in again), not on the jury (copy my sign-in name to send to an admin; it is only copied to the clipboard on a click, never logged or stored), or throttling / 5xx / anything else (Try again). The small "The jury is deliberating…" loader stays for page changes and refreshes. The logic is in `src/launch/`: `launch-machine.ts` (pure state machine) and `launch-stages.ts` (stages and routing), with tests.
- **Language and theme before the profile loads:** the saved EN/ES choice if there is one, otherwise the browser language; the theme follows `prefers-color-scheme`.
- **The Intro** has three steps, can be skipped at any time and is shown once per user: a first-time user goes to the Intro after the launch screen and then to the page they asked for (Home, or the deep link). It can be replayed from Home ("How it works", `#intro`), which writes nothing.
- **"Intro seen" is stored per user in app data**, in the `UserFlag` entity, so it follows the user across devices. It is insert-only (a flag is set when a row exists for `userId` and `flag`; duplicates are harmless), each user can create and read only their own rows, and it stores no email or name. Current flags (constants in `src/data/user-flags.service.ts`, never user input):

  | Flag | Meaning |
  |---|---|
  | `intro_seen` | The user finished or skipped the Intro. |

  If the lookup fails (for example on a deployment that does not have the entity yet), the app treats the Intro as seen instead of blocking the user. Deploy the schema (`rayfin up`) before the code that writes flags.

## Appeals and judge trust (I3b)

- **Reviewing verdicts.** On a hearing, any active juror answers "Yes, agree" or "No, appeal" under each verdict (keys A · X · J/K · ?). A review is an insert-only `VerdictReview`; the latest one per juror and verdict counts. An appeal (a review that differs from the judge) needs a comment.
- **R9.** A ruled case is reopened by a valid `expected_answer_wrong` review from an active approver. Votes cast before the review stay visible in the court record ("before the review") but stop counting; jurors vote again.
- **Judge trust** is computed per agent and per critic-prompt version (a different prompt is a different judge): the current version prominently, earlier ones as history. Rows with a `source` ("seed" demo rows, "check" script rows) never count. Home keeps loading, without the trust line and the judge lines of the ticker, if the verdicts/reviews cannot be read.
- Plan and decisions: [docs/iteraciones/I3b.md](docs/iteraciones/I3b.md). Demo story in the test deployment: `rayfin/seed/i3b-story-1-ruled-case.sql`, one real hearing (`scripts/i3b-run-hearing.mjs`), `rayfin/seed/i3b-story-2-appeal.sql`, then `scripts/i3b-checks.mjs`.

## Case law export (I3c)

- **"Export case law"** on Cases downloads the agent's ruled cases as a CSV for Quality Lab, built in the browser from data already loaded (no new queries, Functions or schema). Header, exactly: `question,expected_answer,category,tags`.
- **Which rows:** ruled cases of that agent whose author is an active juror, not dismissed and **not reopened** (R9), and never example or seeded data (`example-` user ids, `example.com` addresses). The button is disabled, with the reason as a tooltip, when there is nothing to export or when the reviews could not be loaded (reopened cases cannot be ruled out then).
- **Mapping:** `question` = the case text; `expected_answer` = the ruled answer; `category` = the case category; `tags` = the case tags (typed with commas) plus the ruled answer's structured definition as `criterion: …`, `time window: …`, `population: …`, `source: …`, joined with `;`.
- **Safety:** RFC 4180 quoting, UTF-8 with BOM, CRLF; cells that start with `=`, `+`, `-`, `@` or a tab get a leading `'` (a plain number such as `-5` is left alone); no authors, emails or ids. File name: `agent-jury-<agent-slug>-case-law-<yyyy-mm-dd>.csv`. Code: `src/data/case-law-csv.ts`.

## Security model

- **Records are insert-only.** Cases, testimonies, dismissals, votes, verdict reviews and per-user flags are never updated or deleted; every entry keeps its author and date.
- **Read and insert rules live in the data model.** Reading requires sign-in (admin requests and their results are visible only to their author), and inserts must carry the caller's own identity (`claims.sub` / `claims.email`), so nobody writes on someone else's behalf.
- **Jurors and agents are written only through `clerkExecute`.** The browser inserts an `AdminRequest` (its insert policy proves who asks) and calls the Function with the request id only. The Function reads the request with T-SQL as the app identity and enforces the safeguards:
  - it runs only the stored action and payload;
  - each request runs once;
  - requests expire after 2 minutes;
  - the requester must be an active admin;
  - admins can't deactivate themselves or remove their own admin role.
  
  Every outcome, including rejections, is written to `AdminRequestResult`.
- **The client is not a security boundary.** The UI hides admin actions from non-admins, but the server checks every request.
- **Function names must not start with `admin` or `runtime`.** The Azure Functions host reserves those routes, and such Functions return NotFound without running.

## Design

The visual direction is "The Docket", a court newspaper. See the [design guide](docs/design/design-guide.md) and the HTML [mockups](docs/design/mockups/) (open them in a browser). The images in this README are rendered from those mockups, which contain illustrative example data only.

![Clerk's office mockup](docs/design/images/mockup-admin.png)

## Structure

```text
apps/agent-jury/
├── docs/          # Specification, iteration plans and design guide
├── fabric/        # Fabric items outside the app (evaluation and export notebooks)
├── rayfin/        # Rayfin config, data model, Functions and seed scripts
├── scripts/       # Deployed checks, SQL runner and template validation
└── src/           # React frontend
```

## Pinned versions

| Component | Version |
|---|---|
| Rayfin CLI (`@microsoft/rayfin-cli`) | 1.36.2 |
| `fabric-data-agent-sdk` | 0.1.36a0 (pinned in the `evaluate_agent` notebook) |

## License

MIT, copyright Mónica Mesa. See [LICENSE](../../LICENSE).
