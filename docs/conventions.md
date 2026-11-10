# Conventions

Rules shared by every app in Fabric Atelier.

## Project layout

- Each app is an independent npm project under `apps/<app-name>/`, with its own `package.json` and `package-lock.json`.
- The repository root is not an npm workspace and has no `package.json`.
- Run Rayfin commands (`npx rayfin ...`) and npm scripts always from the app folder, never from the repository root.

## Fabric workspaces

- Name Fabric workspaces `FabricApp-<AppName>`, in PascalCase. For example: `FabricApp-AgentJury`.
- Never commit tenant IDs or workspace IDs. Rayfin keeps them in `rayfin/.env` and `rayfin/.deployments.json`, which are ignored by Git.

## Private values

- Personal and tenant-specific values live only in `.private/values.env` at the repository root, which is ignored by Git. Tracked files refer to them by key name, for example `<TENANT_ID>`. See the root README for the setup.
- The pre-commit hook in `.githooks/pre-commit` blocks commits that add those values, unknown GUIDs, emails, deployed app URLs or Windows user paths.

## `rayfin.yml` after a deploy

- `rayfin up` adds the deployed app URL to `services.auth.allowedRedirectUris` on every deploy with static hosting. Only `localhost` and `127.0.0.1` entries are committed.
- After each `rayfin up`, discard that change with `git restore rayfin/rayfin.yml` (from the app folder). Commit any other change to `rayfin.yml` separately.
- Always deploy with the full `npx rayfin up`, never with `--exclude-services staticHosting`, so the app URL is registered again on every deploy and sign-in keeps working.

## Sign-in from scripts (`externalEntraExchange`)

- `services.auth.fabric.externalEntraExchange: true` lets a delegated Entra token (scope `Item.Execute.All`) be exchanged for a Rayfin session without the Fabric portal. It does not grant extra permissions: the user still needs Execute permission on the item and every data policy still applies. It does add a sign-in path that does not go through the portal.
- It is enabled only so that check scripts (for example `apps/agent-jury/scripts/i1a-checks.mjs`) and local automatic sign-in can act as the `rayfin login` user against the deployed app. The app itself does not use it.
- **Templates ship with it off** (absent or `false`). Turn it on in a development deployment only while running checks or local sign-in, and off again before the app is shared with users.

## Capacity usage

- The production and test app items run on the same F2 capacity. The Data Agent will join them later. Every request to either app consumes CU from that shared capacity, and an overloaded capacity throttles all of them: Fabric first delays each interactive request by 20 seconds, then rejects it.
- Run the deployed checks (`scripts/i1*-checks.mjs`) only when code that affects security or data changes: entities, policies, roles, Functions, seed or data services. Run them once, against the test item.
- Take screenshots once per iteration, before the review.
- Never poll a deployed app in a loop, and never leave scripts or a local dev server pointed at it running unattended. To wait for a long job, check its status by hand.
- If every request suddenly takes about 20 s, check the Capacity Metrics app for "Interactive delay" before measuring or debugging anything else.

## Lessons learned

- Every new gotcha goes into [lessons-learned.md](lessons-learned.md) (symptom, cause, what we did, link) in the same commit as its fix. No private data.

## Language

- The user interface is bilingual: English and Spanish, with English as the default.
- Code is written in English: identifiers, comments, commit messages and file names.

## Requirements

- Node.js 24. The Rayfin CLI supports Node.js 20, 22 and 24.
- Install it with winget and pin it so that `winget upgrade` does not move it to a newer major version:

  ```powershell
  winget install --id OpenJS.NodeJS.LTS -e --version <latest 24.x>
  winget pin add --id OpenJS.NodeJS.LTS --version 24.*
  ```

## Exceptions

- `@microsoft/rayfin-mcp` is not pinned to a version in `.mcp.json` or `.vscode/mcp.json`. The Rayfin CLI manages it, and the latest version should always be used.

## Pending

- Re-enable CodeQL in `.github/workflows/` at the repository root when the repository becomes public. The original workflow from the Rayfin template is in commit `569c1ef` (`apps/agent-jury/.github/workflows/codeql.yml`).
- Review `npm audit` vulnerabilities when updating Rayfin and before making the repository public. Use `npm audit --omit=dev` to see only the ones that affect the deployed app.
- Reduce the bundle size by loading each screen on demand (dynamic `import()`) once an app has several screens.
- Publish every app as a Rayfin template, with a `rayfin-template.yml` at the repository root as in [microsoft/awesome-rayfin](https://github.com/microsoft/awesome-rayfin), so anyone can create their own copy with `npm create @microsoft/rayfin@latest -- --template <repo-url> --template-name <app>`. Consequences for development, which apply from now on:
  - No workspace, lakehouse or tenant identifiers in code.
  - App-specific settings (workspace names, lakehouse name) go in a `config.example.env` inside each app.
  - Deployment-specific files are always generated by the Rayfin CLI and never committed.
