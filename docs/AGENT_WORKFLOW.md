# Working with agents on SpotMe

How work is split between Claude (the orchestrator), Antigravity (`agy`) sub-agents and Cursor, and why. Update this file when the workflow changes; the log at the bottom is the record to analyse later.

## Who does what

| Who | Does | Doesn't |
|---|---|---|
| **Claude** | Design, core logic (analysis maths, sync, player engine), specs for delegated jobs, review of every result, commits | Bulk boilerplate when a spec can describe it exactly |
| **agy sub-agents** | (1) Independent review by a different model, read-only. (2) Boilerplate from a spec on its own branch: data models, validators, fixtures, catalogues, translations | Design decisions, anything touching several features at once, deploys, migrations run against a real database, anything needing secrets |
| **Cursor (Damiano)** | Wiring finished data models into React Native screens and components | |

The rule of thumb for delegating: **delegate when the spec is shorter than the code and the result can be checked by a command** (typecheck, tests). If explaining the job takes longer than doing it, or checking it means re-deriving it, Claude does it directly. A job has a fixed cost (briefing, 5–15 minutes of run time, review), so small or tightly coupled changes aren't worth it.

## The loop

1. **Spec.** Claude writes `docs/specs/NNN-name.md` from `docs/specs/TEMPLATE.md`. One spec = one job = one branch. The spec is the whole briefing: the sub-agent knows nothing else.
2. **Run.** On the Mac: `scripts/agy-job.sh docs/specs/NNN-name.md`. Claude's cloud session can't start `agy` (it isn't installed there and can't reach the Mac's terminal), so this step is run by Damiano, or by Claude Code running on the Mac.
   - `mode: read-only` runs in the repo with `--sandbox`; nothing is changed.
   - `mode: write` runs in a separate git worktree (`../.agy-worktrees/NNN-name`, branch `agy/NNN-name`), so it can never collide with work in the main folder.
   - The log is `logs/agy/NNN-name.log`. It stays empty until the job ends: that's normal.
3. **Review.** Claude reads the log and the diff, runs `bun run verify` on the branch, fixes or sends back. Sub-agents don't commit: Claude commits the accepted result as Damiano.
4. **Merge.** The branch is merged into the working branch (or cherry-picked), then the worktree is removed: `git worktree remove ../.agy-worktrees/NNN-name`.
5. **Wire.** Damiano wires the models into the UI with Cursor. Each write spec ends with a "For the UI" section listing what's exported and how to call it.
6. **Log.** One line in the table below: what was delegated, how long, what had to be corrected. This is what tells us whether delegating is paying off.

## Rules for specs

- Bounded: name the files to create and the files that must not be touched.
- Point at the conventions instead of restating them: the closest existing file to imitate, plus `docs/FOLDER_STRUCTURE.md` and `.cursor/rules`.
- State the output contract: what the final message must contain.
- State how it will be checked (`bun run typecheck`, the test file to pass).
- No secrets, no `.env` values, ever.

## Costs

- Default model: `Gemini 3.8 Flash (Medium)`; `Flash (High)` for reviews. Change per spec with `model:`.
- Split a big job into 2–4 narrow ones rather than one long one: they finish sooner and a bad one costs less to redo.
- Don't run a write job to save ten minutes of typing.

## Log

| Date | Spec | Mode | Run time | Outcome | Corrections needed |
|---|---|---|---|---|---|
| 2026-11-16 | 001-review-native-trackers | read-only | 14 min | 6 findings: 1 valid (watch workout aborts if mirroring fails), 1 plausible (Vision tracker not re-seeded after a lost frame), 4 wrong or cosmetic. Nothing at launch. | First run failed: model renamed to Gemini 3.8 Flash. It suggested removing iOS `workout-processing`, which mirroring needs (iOS 17+) |
