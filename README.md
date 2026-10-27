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

### Accounts (optional)

People can sign in with Apple, Google or email and password, using the same Supabase project as the website. Signing in is optional: the app works offline without an account. The sign-in screen appears as the first onboarding step, which can be skipped, and under Profile → Account.

1. Copy `.env.example` to `.env.local` and fill in the Supabase URL, the publishable key and the website URL. Without them, the account screens say sign-in isn't available in this build.
2. Set up Apple and Google in Supabase, Apple Developer and Google Cloud. The steps are in the website README, under "Sign in with Apple and Google". On the app side:
   - add `spotme://auth/callback` to Supabase's redirect URLs;
   - put the bundle ID in the Apple provider's Client IDs;
   - turn on the Sign In with Apple capability for the App ID.
   On a free Apple **Personal Team**, Xcode stops with *"Missing Sign In with Apple"*: free teams can't have that capability. Add `EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN=false` to `.env.local` and rebuild. The build then leaves the capability out, and "Continue with Apple" opens the browser sheet instead of the native one. On a paid account, enable Sign In with Apple on the App ID and remove the line.
3. Rebuild the native app, because new native modules were added (`expo-apple-authentication`, `expo-web-browser`, `expo-crypto`): `bun run prebuild:clean && bun run ios`.

| | iPhone | Android |
|---|---|---|
| Apple | native sheet (ID token + SHA-256 nonce) | Supabase OAuth in the browser sheet |
| Google | Supabase OAuth in the browser sheet (PKCE) | same |
| Email | email and password; confirmation and password-reset links open the website | same |

**Sync.** When the person is signed in and sync is on, the app syncs at startup, when it returns to the foreground, every 5 minutes, and a few seconds after each edit.

- **How changes are found.** Each synced record keeps a fingerprint of the version both sides last agreed on, so the app sends only what changed.
- **Each run.** The app first pulls changes and deletions from the website, then pushes the phone's changes.
- **Conflicts.** If the same record changed on both sides, the website wins.
- **What can delete online.** Only records the phone itself synced and then deleted are deleted online. A new phone, a reinstall or "Erase all data" therefore never wipes the account. "Erase all data" and signing out turn sync off first.
- **Database.** The website migration `20261028090000_app_sync.sql` adds `updated_at`, `client_id` and the `sync_deletions` log.
- **End-to-end test.** `src/features/sync/engine.integration.test.ts` runs the engine against a real backend. It's skipped unless `SYNC_IT_URL`, `SYNC_IT_JWT` and `SYNC_IT_USER` are set, for example to a local `supabase start` and a test user's access token.

The code is in `src/features/account/`. The session is stored in its own MMKV file, so "Erase all data" doesn't sign you out. Account deletion opens the website's settings page.

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

### 5. Account & website sync
- [x] Sign in / sign up in the app with the same Supabase project: Apple, Google, email. Optional, the app works without an account (`src/features/account/`).
- [x] Two-way sync with the website: profile, weight, measurements, BIA, food log, workouts (`src/features/sync/`). It's opt-in, through a checkbox on the sign-in screen (ticked by default) or Profile → Account.
- [ ] Care team in the app: enter an invite code (`accept_invite` RPC), see who has access and to what, pause or end sharing, and accept or decline target suggestions (`decide_recommendation` RPC).
- [ ] Deep link `spotme://invite/<code>` and a universal link from `https://<site>/invite/<code>`.
- [ ] Food history, the dashboard layout and settings like language stay on the device for now.

### 6. Future Enhancements
- [ ] Implement local search for exercises using **ExerciseDB API** (https://www.exercisedb.io/).
    - Allow users to search and add exercises from the database.