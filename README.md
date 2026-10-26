# SpotMe

Offline-first gym & nutrition tracker — Expo SDK 58, React Native 0.88 (New Architecture). Works with Xcode 27 / Device Hub.

## Getting started

```bash
direnv allow        # or: nix develop
bun install
bun run ios         # dev build (MMKV & co. need a native build; Expo Go won't work)
bun run android
```

| Script | What it does |
|---|---|
| `bun run verify` | typecheck + lint + tests + i18n key parity (run before every PR; CI runs the same) |
| `bun run typecheck` / `lint` / `test` | individually |
| `bun run format` | Prettier (with Tailwind class sorting) |
| `bun run i18n:check` | fails if `en.json` and `it.json` keys differ |
| `bun run doctor` | expo-doctor |

Docs: [`docs/APP_GUIDE.md`](docs/APP_GUIDE.md) · [`docs/BODY_TRACKER.md`](docs/BODY_TRACKER.md) · [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md) · [`docs/PROJECT_COMPREHENSION.md`](docs/PROJECT_COMPREHENSION.md) · [`docs/IMPROVEMENT_PLAN.md`](docs/IMPROVEMENT_PLAN.md). Coding rules: `.cursor/rules/` (+ `../.agent/rules/` for Antigravity).

## Roadmap & Todo

### 1. Workout Section
The primary goal is to build out the Workout features.
- [x] Create Workout Plan UI
- [x] Implement exercise tracking
- [x] Add workout schedule management

### 2. Body Measurements & 3D Visualization
See [`docs/BODY_TRACKER.md`](docs/BODY_TRACKER.md).
- [x] 3D body from MPFB2 (male / female / neutral), morphed from height, weight and tape measurements.
- [x] Primary + advanced circumferences, L/R, with green / red regional change highlighting.
- [x] BIA data model and import hook.
- [ ] BIA importers (InBody, Tanita, Withings…) and fat-distribution morphs.
- [ ] Tap a body part to log that measurement.

### 3. Profile Enhancements
- [ ] Add a section to Edit Macros & Calories directly in the Profile (targets are now shown in the profile header).
- [ ] Ensure these edits update the global targets.

### 4. AI Integration
- [ ] Gradually introduce AI features throughout the app.
- [ ] Start with simple recommendations and expand to full coaching.

### 5. Future Enhancements
- [ ] Implement local search for exercises using **ExerciseDB API** (https://www.exercisedb.io/).
    - Allow users to search and add exercises from the database.