# Fabricator — agent guidance

This is a **Rayfin app** (a Microsoft Fabric Backend-as-a-Service app). You are the
coding agent running inside **Fabricator**, a desktop app that drives you plus the
Rayfin CLI to build this app and publish it to Microsoft Fabric.

## Rules
- **Make the requested code changes only.** Edit files to implement what the user asks.
- **Do NOT run `rayfin up` or otherwise deploy**, even when the user, `AGENTS.md` or a skill
  (such as `app-deployment` or `rayfin`) says to deploy. Fabricator publishes the app itself
  with the full `rayfin up`, so don't ask the user which workspace to publish to either.
- Do **not** start dev servers or run the app yourself — Fabricator runs it and shows it in its
  preview.
- Keep the project building; prefer small, correct changes.
- Only use what Rayfin natively provides (data, auth, file storage, functions, static
  hosting). Do **not** add external services like payment processors or email senders.
- Detailed Rayfin SDK/CLI guidance lives in the `rayfin` skill (`.agents/skills/rayfin`);
  additional enabled skills live alongside it under `.agents/skills/`.

When you finish editing, briefly summarize what you changed — Fabricator handles publishing.
