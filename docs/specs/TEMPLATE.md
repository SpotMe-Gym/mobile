---
name: NNN-short-name
mode: write            # write | read-only
model: Gemini 3.8 Flash (Medium)
timeout: 15m
---

# Title: what will exist when this is done

## Context
Two or three sentences: what SpotMe is, which feature this belongs to, why it's needed.
The repo is an Expo (React Native) app in TypeScript. Read `docs/FOLDER_STRUCTURE.md` and `.cursor/rules` first.

## Task
Exactly what to produce.

## Files
- Create: `path/…`
- Imitate: `path/…` (closest existing example of the conventions)
- Do not touch: everything else. No new dependencies. No changes to `package.json`, `app.json`, `ios/`, `android/`.

## Requirements
1. …

## Checks (must pass before you finish)
- `bun run typecheck`
- `npx jest path/to/test`

## Rules
- Do not commit, push, or create branches: leave the changes in the working tree.
- Do not read or print `.env*` files.
- If something in this spec is impossible or contradicts the code, stop and say so instead of guessing.

## Final message
A markdown report: files created, decisions taken where the spec was silent, check results, anything left undone.

## For the UI (write specs)
What the UI will import and call. Filled in by the spec author; confirm or correct it in the final message.
