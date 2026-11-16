# SpotMe

Offline-first gym & nutrition tracker — Expo SDK 58, React Native 0.88 (New Architecture). Works with Xcode 27 / Device Hub.

## Getting started

```bash
direnv allow        # or: nix develop
bun install
bun run ios         # build + install on your iPhone and Apple Watch, then start Metro
bun run android
```

### iPhone and Apple Watch

`bun run ios` does the whole native build, with nothing to set up by hand in Xcode:

1. finds your iPhone and its paired Apple Watch (`xcrun devicectl`);
2. runs `bun install`, and `expo prebuild --clean` only when the native config changed (app.json, app.config.ts, packages, `modules/`, `targets/`, `EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN`);
3. adds the `SpotMeWatch` scheme that prebuild doesn't create (`scripts/watch-scheme.mjs`);
4. signs with the team in `app.json` (`ios.appleTeamId`) and registers the iPhone and the watch with it. The first time it builds the watch app for the watch once, which is what fixes *"This app cannot be installed because its integrity could not be verified"* on the watch;
5. builds, installs SpotMe on the iPhone and the watch app on the watch, starts Metro and opens the app.

| Script | |
|---|---|
| `bun run ios` | Debug: live reload from this Mac (the iPhone has to be on the same Wi-Fi) |
| `bun run ios:release` | Release: the JavaScript is bundled in, so it works at the gym without the Mac |
| `bun run ios:clean` | regenerates `ios/` first |
| `bun run ios -- --no-watch` | iPhone only |
| `bun run ios -- --device "Name" --watch "Name"` | pick the devices when there are several |
| `bun run ios:sim` | the simulator (`expo run:ios`) |

The full xcodebuild output goes to `logs/ios-build.log`; on failure the script prints the errors with what to do about them.

If the app closes about 10 seconds after opening, it's a Debug build that can't reach Metro: it waits for this Mac on the main thread and iOS kills it (crash log: `0x8BADF00D`, `scene-create watchdog`, `RCTBundleURLProvider isPackagerRunning`). Start Metro on the same Wi-Fi, or install `bun run ios:release` to use it away from the Mac.

Once per device: connect the iPhone by cable and tap Trust; turn on Developer Mode on the iPhone and on the watch (Settings › Privacy & Security › Developer Mode); sign in to Xcode › Settings › Accounts with your Apple ID; after the first install, trust the certificate on the iPhone (Settings › General › VPN & Device Management). With a free Apple ID: put `EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN=false` in `.env.local`, and expect the app to stop opening after 7 days, until you run `bun run ios` again.

To work in Xcode instead, open `ios/SpotMe.xcworkspace` and pick the **SpotMe** scheme for the iPhone or **SpotMeWatch** for the watch.

| Script | What it does |
|---|---|
| `bun run verify` | typecheck + lint + tests + i18n key parity (run before every PR; CI runs the same) |
| `bun run typecheck` / `lint` / `test` | individually |
| `bun run format` | Prettier (with Tailwind class sorting) |
| `bun run i18n:check` | fails if `en.json` and `it.json` keys differ |
| `bun run doctor` | expo-doctor |

### Training load, fatigue and the Live Activity

- **Volume and fatigue** (`src/features/sessions/fatigue.ts`): volume is what was lifted (sets, reps, kilograms). Fatigue is a training-load estimate per muscle: each logged set adds a dose to its muscles (helpers count half, effort scales it) that fades with time, faster for small muscles. The player shows the current exercise's volume against last time and its muscles' fatigue; the 3D body has a **Fatigue** colour mode with a per-muscle list. `fatigueForAi()` gives it to the AI coach.
- **Live Activity** (`targets/live`, `modules/spotme-live-activity`): the workout on the Lock Screen and in the Dynamic Island: exercise, set, timer, what's next, heart rate. iOS suspends the app while the phone is locked, so each countdown carries the step that follows and the activity switches to it by itself when the timer runs out.
- **Heart rate** reconnects by itself during a workout (`useHeartRateKeeper`): a strap or watch that stays silent for 12 s is retried.
- **Food search** uses Open Food Facts' search service (`search.openfoodfacts.org`), falls back to the older endpoint, and re-ranks on the phone (`rankFoods.ts`): name coverage first, then country, popularity and completeness; duplicates and entries with impossible numbers are dropped.

### Motion Lab

A section of its own (the Motion Lab card on the home, `/motion`) with two options. Both work from a side-on video, analysed on the phone with Apple Vision (`modules/spotme-motion`, iPhone only for now); the video isn't stored, only the numbers and one still frame.

- **Record my execution**: tap the handle or bar on the first frame. The app follows it and your joints, finds the reps, and reports range, tempo (out / hold / back), speed lost across the set, how far each rep drifts from the target path, and the working joint's angles.
- **Analyse a machine**: tap the handle and the load (top plate of the stack, or the plates), optionally the pivot. The resistance profile is the load's rise per unit of handle travel at each point of the lift (the machine's leverage: cams, lever arms and pulleys are all inside that ratio), normalised to its own peak. No force is measured. The profile is then compared with the textbook strength curve of the movement it's for (`analysis/movements.ts`).

The maths is in `src/features/motion/analysis/` and is tested with simulated machines (`analysis.test.ts`). `motionForAi()` in `motionStore.ts` gives the results as compact data for the AI coach.

### Accounts (optional)

People can sign in with Apple, Google or email and password, using the same Supabase project as the website. Signing in is optional: the app works offline without an account. The sign-in screen appears as the first onboarding step, which can be skipped, and under Profile → Account.

1. Copy `.env.example` to `.env.local` and fill in the Supabase URL, the publishable key and the website URL. Without them, the account screens say sign-in isn't available in this build.
2. Set up Apple and Google in Supabase, Apple Developer and Google Cloud. The steps are in the website README, under "Sign in with Apple and Google". On the app side:
   - add `spotme://auth/callback` to Supabase's redirect URLs;
   - put the bundle ID in the Apple provider's Client IDs;
   - turn on the Sign In with Apple capability for the App ID.
   On a free Apple **Personal Team**, Xcode stops with *"Missing Sign In with Apple"*: free teams can't have that capability. Add `EXPO_PUBLIC_NATIVE_APPLE_SIGN_IN=false` to `.env.local` and rebuild. The build then leaves the capability out, and "Continue with Apple" opens the browser sheet instead of the native one. On a paid account, enable Sign In with Apple on the App ID and remove the line.
3. Rebuild the native app, because new native modules were added (`expo-apple-authentication`, `expo-web-browser`, `expo-crypto`): `bun run ios:clean`.

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

## Audit and roadmap

`docs/AUDIT_AND_ROADMAP.md` is the current list of what's left before a full release: verification, security, privacy and store rules, performance, operations, Android, product gaps and the AI plan, each item with an ID, priority and size.
