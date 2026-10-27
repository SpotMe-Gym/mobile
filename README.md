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

### 5. Account & website sync — **needed**
The website (`SpotMe-Gym/website`, Next.js + Supabase) already has accounts, a web version of the dashboard, and a portal where verified trainers, nutritionists and doctors follow the clients who invite them. The app is still local-only, so until this is built **nothing logged on the phone reaches the website or the professionals**.
- [ ] Sign in / sign up in the app with the same Supabase project (`@supabase/supabase-js`, session in SecureStore). Keep using the app without an account.
- [ ] Sync the local stores two ways with the website tables: `profiles` (gender, birth year, height, goal, targets, units), `weight_entries`, `measurement_entries`, `bia_reports`, `food_entries`, `workouts`. Each table has a `client_id` column, unique per user, so the app can upsert its own local ids idempotently. Last-write-wins on `updated_at` is enough to start.
- [ ] Map the existing MMKV data on first sign-in (one-off upload), then sync incrementally.
- [ ] Care team in the app: enter an invite code (`accept_invite` RPC), see who has access and to what, pause/end sharing, accept or decline target suggestions (`decide_recommendation` RPC).
- [ ] Deep link `spotme://invite/<code>` / universal link from `https://<site>/invite/<code>`.
- [ ] Remove the "app and website keep separate logs" notices on the website once this ships.

See the website README for the schema (`supabase/migrations/`) and the access rules (`can_access`).

### 6. Future Enhancements
- [ ] Implement local search for exercises using **ExerciseDB API** (https://www.exercisedb.io/).
    - Allow users to search and add exercises from the database.