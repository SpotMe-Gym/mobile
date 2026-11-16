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

## Models

Each spec says how much effort the job needs (`effort:` in its front matter) and `scripts/agy-job.sh` picks the model. `model:` overrides it for one spec; the script checks the name against `agy models` before starting.

| `effort:` | Model | For |
|---|---|---|
| `low` | Gemini 3.8 Flash (Low) | Mechanical: translations, fixtures, catalogues, renames |
| `medium` (default) | Gemini 3.8 Flash (Medium) | Boilerplate from an exact spec: data models, validators, tests to a given list |
| `high` | Gemini 4 Argon (High) | Reviews of logic or native code; write jobs with real logic in them |
| `max` | Gemini 4 Hydrogen (High) | Hard reviews: concurrency, security, maths. Hydrogen (XHigh) through `model:` if High isn't enough |

What the Antigravity Pro plan offers (`agy models`, `agy -p "/usage"`):

- **Gemini 3.8 Flash** (Low/Medium/High): fast and cheap. agy's own `flash` subagent.
- **Gemini 4 Argon** (Low/Medium/High): agy's `pro` subagent. Has its own weekly limit on top of the Gemini one, so keep it for jobs that need it.
- **Gemini 4 Hydrogen** (Low/Medium/High/XHigh): the newest and strongest; the only one with XHigh.
- **Claude Opus 5.5, Claude Sonnet 5.5** (Low/Medium/High), **GPT-OSS 120B** (Medium): a separate quota pool. Not used for reviews, which should come from a different model than the one that wrote the code (Claude). Sonnet is the fallback for write jobs when the Gemini limit runs out.

Argon (High) is slow and expensive: review 001 (two Swift modules plus the watch target) took 71 minutes and 22% of Argon's weekly limit, where Flash (High) took 14 minutes. It found more real bugs, including ones that span Swift and TypeScript. Give `high` jobs `timeout: none` and keep them to a few a week.

Quotas: Gemini models share a 5-hour and a weekly limit; Claude and GPT share another. A 14-minute Flash (High) review used about 3% of the Gemini 5-hour limit and 1% of the weekly one. Check with `agy -p "/usage"` before a batch of jobs.

## Costs

- Split a big job into 2–4 narrow ones rather than one long one: they finish sooner and a bad one costs less to redo.
- Don't run a write job to save ten minutes of typing.

## Log

| Date | Spec | Mode | Run time | Outcome | Corrections needed |
|---|---|---|---|---|---|
| 2026-11-16 | 001-review-native-trackers | read-only, Flash (High) | 14 min | 6 findings: 1 valid (watch workout aborts if mirroring fails), 1 plausible (Vision tracker not re-seeded after a lost frame), 4 wrong or cosmetic. Nothing at launch. | First run failed: model renamed to Gemini 3.8 Flash. It suggested removing iOS `workout-processing`, which mirroring needs (iOS 17+) |
| 2026-11-16 | 001-review-native-trackers | read-only, Argon (High) | 15 min, then 30 min | No report either time: it hit the time limit while still reviewing. Used about 21% of the Gemini 5-hour limit and 3% of Argon's weekly limit. | Not usable at `effort: high` for a review this size. The script now reports a timed-out run as failed (agy exits 0 with an empty answer) |
| 2026-11-17 | 001-review-native-trackers | read-only, Argon (High), no time limit | 71 min | 10 findings: 4 valid but minor (duplicate watch session if the start arrives twice; wrist cues skipped after +15s; `frame` duration can be NaN; pose follows a lost tracker), 2 plausible (WCSession read before activation; seed frame when frame 0 fails), 4 wrong. Found cross-file bugs Flash missed. Used 22% of Argon's weekly limit and 6% of the Gemini weekly limit | Called `HKHealthStore()` a launch blocker (it isn't); suggested batching trackers against an intentional comment; also suggested removing iOS `workout-processing`, like Flash |
