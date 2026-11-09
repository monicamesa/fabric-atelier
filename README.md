# Fabric Atelier

A collection of Fabric Apps built with [Rayfin](https://learn.microsoft.com/fabric/apps/overview), the CLI and SDK for Microsoft Fabric Apps.

Each app lives in its own folder under `apps/` and is an independent npm project.

## Apps

| App | Description | Status | Folder |
|---|---|---|---|
| Agent Jury | Who judges the judge? Business experts agree on the expected answers for Fabric Data Agents and review the verdicts of the LLM judge. | In development | [apps/agent-jury](apps/agent-jury) |

## Common requirements

- Node.js 24, pinned with winget (the Rayfin CLI supports Node.js 20, 22 and 24).
- Git.
- A Microsoft Fabric tenant with the Fabric Apps workload enabled, and a workspace where you are Contributor, Member or Admin.
- Each app may add its own requirements; see its README.

See [docs/conventions.md](docs/conventions.md) for the rules shared by all apps.

## One-time setup after cloning

1. Create your private values file from the example and fill it in. It is ignored by Git:

   ```powershell
   New-Item -ItemType Directory -Force .private | Out-Null
   Copy-Item private.example.env .private/values.env
   notepad .private/values.env
   ```

2. Enable the versioned Git hooks:

   ```powershell
   git config core.hooksPath .githooks
   ```

The pre-commit hook blocks any added line that contains a value from `.private/values.env`, a GUID that is not on its allowlist, an email that is not a noreply or `example` address (`example.com`, `example.org`, `example.net` or any `*.example` domain), a deployed Fabric Apps URL, a Fabric portal workspace link or a Windows user path. If `.private/values.env` is missing, it warns and runs only the generic checks.

## Working on an app

Always run npm and Rayfin commands from the app folder, never from the repository root:

```powershell
cd apps/agent-jury
npm ci
npm run dev
```

## Commit convention

Prefix every commit message with the app it affects, followed by a colon:

```text
agent-jury: add vote entity and consensus tests
```

Use `repo:` for changes that only affect the repository root (README, shared docs, `.gitignore`).
