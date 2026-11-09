# Agent Jury

> **Who judges the judge?**

Agent Jury is a Fabric App where business experts decide which answers a Fabric Data Agent should give, and check whether the LLM judge that evaluates the agent agrees with them.

- Experts propose test questions (**cases**) with the answer they consider correct (**testimony**) and the metric definition behind it.
- Other experts vote. A case is **ruled** when it reaches consensus, or **disputed** when areas disagree.
- The app launches evaluations of the agent against ruled cases (**hearings**) and lets experts confirm or correct the judge's verdicts (**appeals**).
- Ruled cases can be exported as a CSV compatible with Data Agent Quality Lab.

**Status:** In development. See the full specification in [docs/especificacion-general.md](docs/especificacion-general.md) (Spanish).

## Structure

```text
apps/agent-jury/
├── docs/          # Specification and design notes
├── fabric/        # Fabric items outside the app (notebooks evaluate_agent and export_case_law)
├── rayfin/        # Rayfin configuration (rayfin.yml)
├── scripts/       # Template validation scripts
└── src/           # React frontend
```

## Requirements

- Node.js 24 and Git. See the [common requirements](../../README.md#common-requirements).
- Fabric capacity F2 or higher, paid (Data Agents and their evaluation do not run on trial capacities).
- Data Agents enabled in the tenant.

## Pinned versions

| Component | Version |
|---|---|
| Rayfin CLI (`@microsoft/rayfin-cli`) | 1.36.2 |
| `fabric-data-agent-sdk` | To be pinned in iteration 3 |

## Commands

Run every command from this folder:

```powershell
npm ci             # install dependencies
npm run dev        # local dev server
npm test           # unit tests
npm run build      # production build
```

Deployment (`npx rayfin up`) targets the `FabricApp-AgentJury` workspace. Deployment values are stored in `rayfin/.env` and `rayfin/.deployments.json`, which are not committed.
