---
name: 002-machine-profile-format
mode: write
effort: medium
timeout: 20m
---

# Machine profile sheet: the data format for a gym machine's resistance profile

## Context
SpotMe is an Expo (React Native) app in TypeScript. Its Motion Lab feature measures a gym machine's resistance profile from video: relative resistance (0–1 of its own peak) at 21 even steps of the range of motion, 0 = start of the lift (`src/features/motion/analysis/machine.ts`, `PROFILE_STEPS`). The same profile can also come from the manufacturer or from other users. This job creates the one data format all three sources share: a "machine profile sheet" that a manufacturer can fill in and the app can import.

Read first: `docs/FOLDER_STRUCTURE.md`, `.cursor/rules/code-standards.mdc`, `src/features/motion/analysis/machine.ts`, `src/features/motion/analysis/movements.ts`, `src/features/motion/motionStore.ts`.

## Task
Create the data model, its validation, conversions to and from what the app already has, example data, tests, and a one-page description of the format for manufacturers. No UI.

## Files
- Create `src/features/motion/machineProfile/schema.ts`
- Create `src/features/motion/machineProfile/convert.ts`
- Create `src/features/motion/machineProfile/examples.ts`
- Create `src/features/motion/machineProfile/machineProfile.test.ts`
- Create `docs/MACHINE_PROFILE_FORMAT.md`
- Imitate: `src/features/motion/analysis/movements.ts` for style (doc comments say why, named exports, no default exports), `src/features/motion/analysis/analysis.test.ts` for tests.
- Do not touch anything else. No new dependencies (`zod` 4 is already installed). No changes to `package.json`, `app.json`, `ios/`, `android/`, locale files.

## Requirements

### schema.ts
A zod schema `machineProfileSheetSchema` and its inferred type `MachineProfileSheet`:

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | literal `1` | |
| `manufacturer` | string | 1–80 chars, trimmed |
| `model` | string | 1–120 chars, trimmed |
| `line` | string, optional | product line, ≤ 80 chars |
| `movement` | `MovementId` | must be one of the ids in `MOVEMENTS` (`movements.ts`); build the enum from that array, don't retype the list |
| `loadType` | `'stack' \| 'plate' \| 'other'` | weight stack, plate-loaded, anything else |
| `source` | `'manufacturer' \| 'measured' \| 'community'` | |
| `profile` | array of `{ position: number, resistance: number }` | 5–101 points; `position` 0–100 (% of range of motion, 0 = start of the lift), strictly increasing, first is 0 and last is 100; `resistance` > 0 and ≤ 100 (% of peak), at least one point equal to 100 |
| `armSwingDegrees` | number, optional | 1–360: rotation of the movement arm over the lift |
| `cam` | array of `{ angle: number, radius: number }`, optional | 3–181 points; `angle` in degrees strictly increasing; `radius` in mm > 0 |
| `armLength` | number, optional | mm, > 0: pivot to the centre of the handle |
| `adjustments` | array of `{ name: string, positions: number }`, optional | seat, start angle…; `positions` integer 1–50 |
| `notes` | string, optional | ≤ 500 chars |

Unknown keys are rejected (`z.strictObject`). Export `parseMachineProfileSheet(input: unknown)` returning `{ ok: true, sheet } | { ok: false, errors: string[] }` where each error is `"path: message"` in plain English.

### convert.ts
- `profileFromSheet(sheet): number[]`: the sheet's profile resampled by linear interpolation to `PROFILE_STEPS` values, 0–1 of its peak (peak exactly 1), rounded to 3 decimals. This is the shape `fitMachine()` and `classify()` take.
- `profileFromCam(cam, armLength): number[]`: relative resistance from geometry alone: at each of `PROFILE_STEPS` even steps of the cam's angle range, cam radius ÷ arm length (interpolating the radius), normalised to a peak of 1.
- `sheetFromMeasurement(record: MachineRecord, meta: { manufacturer: string; model: string; line?: string; loadType: MachineProfileSheet['loadType'] }): MachineProfileSheet`: a sheet with `source: 'measured'` from a Motion Lab result (`record.result.profile` → 21 points at positions 0, 5, … 100; `armSwingDegrees` from `record.result.arm?.degrees`). The result must pass `machineProfileSheetSchema`.
- Invariant to test: `profileFromSheet(sheetFromMeasurement(r, meta))` equals `r.result.profile` to within 0.001 at every step.

### examples.ts
`EXAMPLE_SHEETS: MachineProfileSheet[]` with three sheets for an invented brand "Example Fitness" (never a real manufacturer or model name): an ascending chest press (stack), a bell-shaped leg extension with `cam` and `armLength` (stack), a descending row (plate). All must pass the schema.

### machineProfile.test.ts
Jest tests: every example passes; each rule in the table rejects a counter-example with a readable error; unknown keys are rejected; resampling a 5-point sheet gives 21 values with peak 1; `profileFromCam` of a constant-radius cam is flat (all 1); the round-trip invariant above; `classify(profileFromSheet(example))` gives `'ascending'`, `'bell'`, `'descending'` for the three examples.

### docs/MACHINE_PROFILE_FORMAT.md
One page for a manufacturer's engineer: what the sheet is for, the field table in plain words, how to measure `profile` (load travel per unit of handle travel, normalised), one complete JSON example (Example Fitness), and what's optional. No marketing language.

## Checks (must pass before you finish)
- `bun run typecheck`
- `bun run lint`
- `npx jest src/features/motion`

## Rules
- Do not commit, push, or create branches: leave the changes in the working tree.
- Do not read or print `.env*` files.
- If something in this spec is impossible or contradicts the code, stop and say so instead of guessing.

## Final message
A markdown report: files created, decisions taken where the spec was silent, the output of the three checks, anything left undone.

## For the UI
Cursor will later build an "Import a machine sheet" screen and a share button on a machine result. It will call:
- `parseMachineProfileSheet(json)` to validate a pasted or scanned sheet and show `errors`;
- `profileFromSheet(sheet)` then the existing `fitMachine(profile, sheet.movement)` and `classify(profile)` to show the same result screen as a measured machine;
- `sheetFromMeasurement(record, meta)` + `JSON.stringify` to share a measured machine.
