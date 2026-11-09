# Conventions

Rules shared by every app in Fabric Atelier.

## Project layout

- Each app is an independent npm project under `apps/<app-name>/`, with its own `package.json` and `package-lock.json`.
- The repository root is not an npm workspace and has no `package.json`.
- Run Rayfin commands (`npx rayfin ...`) and npm scripts always from the app folder, never from the repository root.

## Fabric workspaces

- Name Fabric workspaces `FabricApp-<AppName>`, in PascalCase. For example: `FabricApp-AgentJury`.
- Never commit tenant IDs or workspace IDs. Rayfin keeps them in `rayfin/.env` and `rayfin/.deployments.json`, which are ignored by Git.

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
