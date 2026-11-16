# SpotMe: audit and roadmap to a full release

Written 2026-11-17 from a read of both codebases (mobile app on `feat/tracking-platform`, website and Supabase backend), automated checks (`bun audit`, `bun outdated`, test coverage) and research on the current store, privacy, security and AI rules. Sources are at the end.

How to use it: every item has an ID (`SEC-03`), a priority and a rough size. Priorities: **P0** = must be done before anyone outside the team uses the app; **P1** = before a public store release; **P2** = soon after. Sizes: **S** = hours, **M** = days, **L** = a week or more. Sizes are estimates.

Two things this document is not: legal advice (the privacy section says where a lawyer or data protection officer is needed), and a claim that the app works on a device. Most of the native code has never been run.

---

## 1. Where the app stands

### What exists

| Area | State |
|---|---|
| Mobile app | Expo SDK 58, React Native 0.88 (new architecture), TypeScript. About 27,493 lines in 244 files, 45 test files, 218 tests passing, 67% statement coverage. English and Italian, 809 text keys each. |
| Features in the app | Home with editable widgets, body (weight, measurements, 3D body, fatigue), nutrition (search, barcode, quick add), workouts (editor, weekly plan, player with timers), heart rate (Bluetooth and Apple Watch), music controls, Motion Lab, accounts and sync. |
| iPhone-only native code | Apple Watch app, HealthKit bridge, Live Activity (Lock Screen and Dynamic Island), Motion Lab video tracker, Apple Music now playing. |
| Website | Next.js 16 with Supabase. Member area, a professionals area (coaches and nutritionists with patients, invites, notes, target recommendations), admin verification of professionals, data export. |
| Backend | Supabase Postgres with row-level security on every table, 6 migrations, database tests. |
| AI | Not started. The chat screen is a placeholder. Two data feeds are ready for it: `motionForAi()` and `fatigueForAi()`. |

### What has never been verified

This is the largest risk in the project, larger than any single finding below.

| Code | Status |
|---|---|
| Apple Watch app (`targets/watch`) and HealthKit bridge | Builds. Whether it installs and runs on the watch end to end (heart rate, controls) is not confirmed. |
| Motion Lab tracker (`modules/spotme-motion`) | Written without a compiler. Reviewed once by a second model: one plausible bug open (see `QA-03`). Never run. |
| Live Activity (`targets/live`, `modules/spotme-live-activity`) | Written without a compiler. Never built. |
| Workout editor drag and drop, home grid drag, body slider gestures | Logic tested; the gestures only run on a device. |
| Heart rate keeper, food search ranking, fatigue model | Tested with simulated data. Not checked against real straps, real searches or how recovery actually feels. |
| Android | The app has never been built for Android in this branch. |
| A Debug build closing at launch on the phone | Reported on 2026-11-16, cause not confirmed (see `QA-01`). |

---

## 2. Before anything else: the twelve blockers

In order. The first three decide whether the rest of the plan is built on something that works.

| # | ID | What | Why it blocks |
|---|---|---|---|
| 1 | `QA-01` | Get a build that opens and stays open on the phone; capture the crash log if it doesn't | Nothing else can be tested |
| 2 | `QA-02` | Walk through every feature on a real iPhone and watch, fix what breaks | Most native code is unverified |
| 3 | `OPS-01` | Crash and error reporting (Sentry or similar) | Without it, failures on other people's phones are invisible |
| 4 | `SEC-01` | Encrypt the sign-in tokens on the phone | They are stored in plain text today |
| 5 | `PRIV-01` | Privacy policy, consent and data-processing basics for health data under GDPR | The app stores health data of people in the EU, and shares it with professionals |
| 6 | `STORE-01` | Correct the app's privacy declarations (the manifest says it collects nothing) | App Store rejection, and it's untrue |
| 7 | `SEC-04` | Security headers, sign-up protection and stronger password rules on the website | Standard web protections are missing |
| 8 | `PERF-01` | Stop the sync running every few seconds during a workout | Battery, data and server load |
| 9 | `PERF-02` | Move workout history out of one ever-growing saved blob | The app will slow down as history grows, and can lose data on Android |
| 10 | `OPS-02` | A paid Apple Developer account, TestFlight and a release pipeline | A free account can't publish, expires builds after 7 days and can't use Sign in with Apple |
| 11 | `AND-01` | Decide Android's scope and build it once | Half the planned audience; several features are iPhone-only |
| 12 | `AI-01` | The AI's server side, consent screen and guardrails, before any AI feature | Apple and EU rules apply from the first AI message |

---

## 3. Quality and verification

| ID | P | Size | Item |
|---|---|---|---|
| `QA-01` | P0 | S | **Launch crash.** Build with `bun run ios:release` (the Debug build needs the Mac reachable). If it still closes: read the crash log (iPhone: Settings › Privacy & Security › Analytics & Improvements › Analytics Data, newest `SpotMe…` file). Suspects in order: a native module's start-up code (watch bridge sets up HealthKit handlers when first used), a JavaScript error at start-up (a Release build closes on one), the new Live Activity target's signing. |
| `QA-02` | P0 | L | **Device test pass.** One checklist, run on an iPhone with a watch, and repeated before each release: onboarding; account sign-up, sign-in (email, Apple, Google), sign-out; sync both ways with the website; weight and measurements; 3D body in all three colour modes; food search, barcode, quick add; workout editor (create, reorder by drag, edit, delete); player (reps set, timed set, two phases, rest, pause, skip, back, lock the phone mid-rest); heart rate from a strap and from the watch; watch controls; Live Activity on Lock Screen and Dynamic Island; music controls; Motion Lab both modes; home edit mode; export and erase data. Record results in `docs/TEST_PASS.md`. |
| `QA-03` | P1 | S | **Motion tracker re-seed.** When Vision loses a tracked point for a frame, the tracker keeps the old observation and may not recover. Re-seed from the last good box, or mark the rest of the clip as lost so the result says "rough reading". Found by the second-model review (`docs/AGENT_WORKFLOW.md` log). |
| `QA-04` | P1 | M | **End-to-end tests.** Maestro flows for the five paths that must never break: sign in, log weight, log food, run a workout to the end, sync. Run on every pull request on a simulator. |
| `QA-05` | P1 | M | **Coverage where it's thin.** 67% overall, but the screens with most logic have little: `app/workouts/session.tsx`, `app/nutrition/*`, account flows. Target the sync engine and the player at 90%+, since a bug there loses data. |
| `QA-06` | P1 | S | **Native unit tests.** The Swift code has none. At least: the watch's message decoding, the Live Activity payload decoding, the motion tracker's coordinate conversion. Run with `xcodebuild test` in CI on a Mac runner. |
| `QA-07` | P2 | M | **Calibrate the estimates.** Fatigue half-lives and levels, Motion Lab's fit thresholds and tracking accuracy, heart-rate retry timings. Each is a first guess. Collect a few weeks of real use and adjust; record what changed and why. |
| `QA-08` | P1 | S | **Accessibility pass.** The code has 161 accessibility labels, a good start. Still to do: test with VoiceOver and TalkBack on the device pass; support larger text sizes (no text scaling limits are set, so check that screens don't break at 200%); check colour contrast of grey-on-dark text against WCAG 2.2 AA (4.5:1); make every drag action also possible without dragging (done for the workout editor and home grid, check Motion Lab marking). |

---

## 4. Security

Organised by the eight groups of the OWASP Mobile Application Security Verification Standard (storage, cryptography, authentication, network, platform, code, resilience, privacy), then the backend and website.

### Mobile

| ID | P | Size | Group | Finding and fix |
|---|---|---|---|---|
| `SEC-01` | P0 | S | Storage | **Sign-in tokens are stored unencrypted.** `src/features/account/supabase.ts` keeps the Supabase session in an MMKV file with no encryption key. Fix: create the MMKV instance with an encryption key generated once and stored in the Keychain / Keystore (`expo-secure-store`, already installed), or store the session through SecureStore directly. Migrate existing sessions on first launch. |
| `SEC-02` | P1 | M | Storage | **Health data is stored as plain files.** Every store (weight, body, food, sessions, motion) is JSON in AsyncStorage. iOS encrypts app files while the phone is locked, but the data is readable in unencrypted backups and on a compromised device. Fix as part of `PERF-02`: move to an encrypted store (MMKV with a Keychain-held key, or SQLite with SQLCipher). On Android set `android.allowBackup` to false or exclude these files from cloud backup. |
| `SEC-03` | P1 | S | Platform | **Custom URL scheme for sign-in callbacks.** `spotme://auth/callback` can be claimed by another app on Android. PKCE (already used) makes a stolen callback useless on its own, but the standard is verified links: Universal Links on iOS and App Links on Android for the auth callback and for Spotify. |
| `SEC-05` | P1 | S | Network | **No certificate or transport hardening.** The app relies on default HTTPS, which is acceptable. Confirm no plain-HTTP exception is configured, and decide explicitly whether to pin the Supabase certificate (most apps of this kind don't; it adds an outage risk). Record the decision. |
| `SEC-06` | P1 | S | Code | **Dependency vulnerabilities.** `bun audit` reports 79 (1 critical, 47 high). Nearly all are in build and test tools that don't ship in the app (`shell-quote` via React Native dev tools, `ws` via Metro and jsdom, `minimatch`, `glob`). Run `bun audit fix`, re-check, and add `bun audit --prod` to CI so a vulnerability in shipped code fails the build. |
| `SEC-07` | P2 | S | Code | **Input from outside is validated in most places** (zod on food API and forms). Gaps to close: the JSON returned by the motion native module is cast without validation (`runAnalysis.ts`); watch messages are parsed with a cast. Validate both. |
| `SEC-08` | P2 | M | Resilience | **No tamper or jailbreak detection, no screenshot protection.** Not required for a fitness app. Worth doing later: App Attest (iOS) and Play Integrity (Android) on the AI endpoint, to stop scripts using your paid AI quota (see `AI-06`). |
| `SEC-09` | P1 | S | Auth | **Session handling.** Add: sign out everywhere, a visible list of signed-in devices (Supabase supports revoking sessions), and re-authentication before export or account deletion. |
| `SEC-10` | P1 | S | Privacy | **Logs.** One `console.error` in development only, and `reportError` says not to attach health data. Keep that rule when `OPS-01` adds a real reporter: scrub request bodies and breadcrumbs. |

### Backend (Supabase)

The database is in good shape: row-level security is on for every table, helper functions set an empty `search_path`, anonymous access is revoked, grants are explicit, and no code uses the service-role key.

| ID | P | Size | Finding and fix |
|---|---|---|---|
| `SEC-11` | P0 | S | **Password rules are weak.** `supabase/config.toml` has a 6-character minimum and no requirements. Set 10+ characters, turn on leaked-password protection and `secure_password_change`. Check the hosted project's dashboard settings match the file. |
| `SEC-12` | P0 | S | **No sign-up or sign-in abuse protection.** Turn on a captcha (Turnstile or hCaptcha, both supported by Supabase Auth) for sign-up, password reset and sign-in, and review the auth rate limits. |
| `SEC-13` | P1 | S | **Invite codes can be guessed at.** `preview_invite(code)` is callable without signing in. Make sure codes are long and random (128 bits), expire, and that the function is rate limited (a small table of attempts per IP, or behind an Edge Function). |
| `SEC-14` | P1 | M | **No audit trail for professionals reading patient data.** A professional with access can read a patient's weight, body, food and workouts, and nothing records it. Add an access log (who, whose data, which scope, when), shown to the patient. This is also what GDPR's accountability principle expects for health data. |
| `SEC-15` | P1 | S | **Two-factor sign-in for professionals and admins.** They see other people's health data. Supabase Auth supports TOTP; require it for the `pro` and `admin` roles and enforce it in the row-level security policies (`aal2`). |
| `SEC-16` | P1 | S | **Credential documents.** The storage bucket is private with a size limit and allowed file types. Add: virus scanning before an admin opens a file, and deletion of documents once verification is decided. |
| `SEC-17` | P2 | S | **Backups and recovery.** Confirm the Supabase plan's backup retention, turn on point-in-time recovery before launch, and rehearse one restore. |

### Website

| ID | P | Size | Finding and fix |
|---|---|---|---|
| `SEC-04` | P0 | S | **No security headers.** `next.config.ts` sets none. Add a Content-Security-Policy (with nonces for scripts), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `frame-ancestors 'none'`. |
| `SEC-18` | P1 | S | **Server actions.** Five action files handle writes. Confirm each one validates its input with zod and checks the signed-in user itself, without relying on the page that calls it; add a test per action for "called by the wrong user". |
| `SEC-19` | P1 | S | **Rate limits on the two API routes and on actions** (`/api/export` builds a full export per call). Limit per user. |
| `SEC-20` | P1 | S | **No CI for the website.** Add the same pipeline as mobile: typecheck, lint, tests, database tests, `bun audit`. |
| `SEC-21` | P2 | M | **External security review.** Before a public launch with health data and professional accounts, pay for a penetration test of the website, API and app. |

---

## 5. Privacy and compliance

This section needs a lawyer or data protection officer to confirm. It lists what the rules require as far as I could establish, and what the code does today.

### GDPR (the user and the first audience are in the EU)

| ID | P | Size | Item |
|---|---|---|---|
| `PRIV-01` | P0 | L | **Health data is a special category (Article 9).** Weight, body measurements, body composition, heart rate, food and training data about an identified person need a legal basis, in practice explicit consent. Required: a consent screen at sign-up that names each kind of health data and each purpose, stored with a timestamp and policy version; withdrawal as easy as giving it; no pre-ticked boxes. |
| `PRIV-02` | P0 | M | **Data protection impact assessment.** Large-scale health data plus sharing with professionals plus AI analysis is the textbook case that needs one (Article 35). Write it before launch; it also produces most of the privacy policy. |
| `PRIV-03` | P0 | S | **Processor agreements.** Sign data processing agreements with every company that handles the data: Supabase (and choose an EU region), the hosting provider, the AI provider, the error reporter. List them in the privacy policy. For providers outside the EU, document the transfer mechanism. |
| `PRIV-04` | P0 | M | **Privacy policy and terms.** The website has pages for both. Have them reviewed against what the app actually does, including: Open Food Facts searches (the search text leaves the device), exercise photos loaded from a CDN, Spotify, Apple Health, the professionals feature, and AI when it arrives. |
| `PRIV-05` | P1 | M | **The professionals feature.** A coach or nutritionist seeing a member's data is a second controller or a processor, depending on the setup. Needs: a clear consent step when a member accepts an invite (per scope, already modelled as `care_scope`), the access log from `SEC-14`, an agreement professionals accept, and a rule for what happens to notes and recommendations when the relationship ends. |
| `PRIV-06` | P1 | S | **Rights.** Export exists (`/api/export`), erase exists (`delete_my_data`, `delete_my_account`). Add Motion Lab results and, later, AI conversations to both. Add a way to correct data and to object, and a contact address. |
| `PRIV-07` | P1 | S | **Children.** Decide a minimum age and enforce it at sign-up. Italy's age of digital consent is 14; below it, parental consent is needed. |
| `PRIV-08` | P1 | S | **Retention.** Write down how long each kind of data is kept and delete on schedule (inactive accounts, credential documents, logs, AI conversations). |
| `PRIV-09` | P1 | S | **Breach plan.** A one-page procedure: who decides, how to notify the authority within 72 hours and users when the risk is high. |
| `PRIV-10` | P2 | S | **Cookies.** The website uses only necessary cookies today (session, language). If analytics are added, a consent banner is needed first. |

### Apple App Store

| ID | P | Size | Item |
|---|---|---|---|
| `STORE-01` | P0 | S | **Privacy manifest and labels.** `app.json` declares `NSPrivacyCollectedDataTypes: []`, meaning "collects nothing". With accounts and sync it collects email, name, health and fitness data, and user content. Declare each, with "linked to the user" and "not used for tracking", and fill in the matching privacy labels in App Store Connect. Re-check when crash reporting and AI are added. |
| `STORE-02` | P0 | S | **Sharing data with AI needs disclosure and permission.** Since November 2025, guideline 5.1.2(i) says apps must clearly disclose where personal data is shared with third parties, including third-party AI, and get explicit permission first. See `AI-03`. |
| `STORE-03` | P1 | S | **Health data rules (5.1.3).** HealthKit and fitness data may not be used for advertising, marketing or data mining, and Apple's long-standing rule is that personal health information is not stored in iCloud. The app syncs to its own backend, which is allowed with consent; state it in the privacy policy and the Health permission text. Never write made-up data to Apple Health. |
| `STORE-04` | P1 | S | **Account deletion.** Apps with account creation must let people start deletion from inside the app. Today "Delete account" opens the website. That is accepted when the link goes straight to the deletion page; better is an in-app confirmation that calls `delete_my_account` directly. |
| `STORE-05` | P1 | S | **Sign in with Apple.** An app that offers a third-party sign-in (Google here) must also offer an equivalent privacy-focused option; Sign in with Apple is the usual one. The native flow is off on the free developer account; it must be on in the store build (`OPS-02`). |
| `STORE-06` | P1 | S | **Export compliance.** Set `ITSAppUsesNonExemptEncryption` to false in `app.json` (the app uses only standard HTTPS), or App Store Connect asks on every upload. |
| `STORE-07` | P1 | S | **Medical claims.** Keep the app a fitness and wellness app: no diagnosis, no treatment advice. Add a short disclaimer in onboarding and near the fatigue and AI features. Apps that measure health with sensors alone face extra scrutiny; Motion Lab measures movement, not health, and should say so. |
| `STORE-08` | P1 | M | **Review material.** A demo account, a note explaining the watch app, HealthKit use, the Live Activity and the professionals feature, screenshots for each device size, an app preview, a support URL. |
| `STORE-09` | P2 | S | **Open Food Facts attribution and contact.** Their terms ask apps to identify themselves; the code has a `TODO(release)` to add a contact address to the User-Agent. Credit the database in the app. Same for the Free Exercise DB (public domain) and Spotify's branding rules. |

### Google Play

| ID | P | Size | Item |
|---|---|---|---|
| `STORE-10` | P1 | S | **Target Android 16 (API 36).** Required for new apps and updates since 31 August 2026. Check what Expo SDK 58 targets by default and raise it with `expo-build-properties` if needed. |
| `STORE-11` | P1 | S | **Health apps declaration and disclaimer.** Complete the health apps declaration in Play Console; the store description must say the app is not a medical device and does not diagnose, treat, cure or prevent any condition, and the app must tell people to consult a professional for medical advice. |
| `STORE-12` | P1 | S | **Data safety form, privacy policy link in the app and the listing, and a web link for account deletion.** |
| `STORE-13` | P1 | M | **Health Connect.** The Android equivalent of Apple Health. Its data is treated as sensitive and needs its own declaration. See `AND-03`. |

### EU AI Act

| ID | P | Size | Item |
|---|---|---|---|
| `STORE-14` | P0 for AI | S | **Tell people they're talking to an AI.** The Article 50 transparency duties have applied since 2 August 2026: people must be clearly informed they are dealing with an AI system unless it's obvious. Label the coach as AI on every screen where it speaks, and mark AI-written plans and summaries as AI-generated. Fines for breaching these duties go up to €15 million or 3% of turnover. |
| `STORE-15` | P1 | S | **Stay out of the high-risk and medical-device categories.** An AI that gives general fitness and nutrition coaching is not high-risk under the Act. One that diagnoses, or decides on treatment, would be a medical device with a different regime. Write the boundary into the AI's instructions and test it (`AI-07`). |

---

## 6. Performance and optimisation

### Mobile

| ID | P | Size | Finding and fix |
|---|---|---|---|
| `PERF-01` | P0 | S | **Sync runs every few seconds during a workout.** `syncLoop.ts` schedules a sync 3 seconds after any change to any store. During a session the heart rate adds a sample every 5 seconds and the player saves its position on every step, so the whole session row is uploaded again and again. Fix: don't sync a session in progress more than once a minute (or only when a set is logged), and ignore changes that only touch `player` or `heartRate`. |
| `PERF-02` | P0 | L | **All history is saved as one blob per store.** Each store rewrites its entire content to AsyncStorage on every change: every heart-rate sample rewrites every workout ever done. It gets slower with use, and AsyncStorage on Android has size limits (large single entries can fail to read, and the classic implementation caps total storage at 6 MB by default). Fix: move sessions, food entries and measurements to SQLite (`expo-sqlite`), one row per record, with the zustand stores as a cache of what's on screen. Do it together with encryption (`SEC-02`). Write a migration and test it with a large fake history. |
| `PERF-03` | P1 | S | **Derived data is recomputed on every render in places.** `muscleFatigue`, `weeklyVolume`, `lastPerformance` and the dashboard insights scan all sessions. They're memoised per screen, but each widget does its own scan. Compute once per change in a shared selector, or in SQL once `PERF-02` is done. |
| `PERF-04` | P1 | S | **Start-up work.** The 800 KB exercise library is parsed at launch because `library.ts` imports it statically and prepares its search text. Load it on first use of the picker. Measure cold start before and after (target under 2 seconds to the home screen on a mid-range phone). |
| `PERF-05` | P1 | S | **The player ticks five times a second and re-renders the whole screen.** Move the countdown text and ring into their own component subscribed to the clock, so the rest of the screen renders only on step changes. |
| `PERF-06` | P1 | S | **App size.** Three 1.2 MB body models ship in the app; only one is used per person. Download the one needed, or compress with Draco or meshopt. The 1.2 MB icon source is stored twice in the repo. |
| `PERF-07` | P2 | S | **Images.** Exercise photos come from a public CDN at full size. Use `expo-image` everywhere (5 files do), set sizes and caching policy, and prefetch the photos of today's workout. |
| `PERF-08` | P2 | M | **Motion Lab speed.** The tracker reads frames one at a time with an image generator (about 10–30 seconds for a 20-second clip, an estimate). An `AVAssetReader` pipeline is several times faster. Do after `QA-02` confirms it works at all. |
| `PERF-09` | P2 | S | **Measure.** Add performance marks for cold start, time to interactive, sync duration and player frame drops, reported through `OPS-01`. |
| `PERF-10` | P2 | S | **Battery in a workout.** Screen kept awake, Bluetooth, a 200 ms timer, sync. After `PERF-01` and `PERF-05`, measure a one-hour session's battery use on a real phone. |

### Website

| ID | P | Size | Finding and fix |
|---|---|---|---|
| `PERF-11` | P2 | S | Check Core Web Vitals on the member dashboard (it loads three.js and charts). Load the 3D body only when its card is on screen. |
| `PERF-12` | P2 | S | Add indexes for the queries the dashboard runs most (by user and day), verified with `explain` on realistic data. |

---

## 7. Operations and release

| ID | P | Size | Item |
|---|---|---|---|
| `OPS-01` | P0 | S | **Crash and error reporting.** `reportError` is a stub that only logs in development. Add Sentry (or similar) to the app, the website and the Edge Functions, with source maps, release names and health data scrubbed. Declare it in the privacy manifest and policy. |
| `OPS-02` | P0 | S | **Apple Developer Program.** The free account can't publish, expires builds after 7 days, has no TestFlight, and can't use Sign in with Apple or push. Enrol, then turn native Apple sign-in back on. |
| `OPS-03` | P1 | M | **Release pipeline.** `eas.json` names channels and a development client, but `expo-updates` and `expo-dev-client` aren't installed, so neither works. Decide: EAS Build and Submit for store builds (recommended), `expo-updates` for fixes between store releases. Set up TestFlight and Play internal testing. |
| `OPS-04` | P1 | S | **CI.** Mobile CI runs typecheck, lint, tests, the text check and `expo-doctor`. Add: `bun audit --prod`, a build of both platforms on pull requests that touch native code, and the end-to-end flows (`QA-04`). Add CI to the website (`SEC-20`). |
| `OPS-05` | P1 | S | **Environments.** One Supabase project today. Create separate development, staging and production projects; never test against production data. |
| `OPS-06` | P1 | S | **Database migrations.** Apply through CI from the repo, never by hand in the dashboard. The earlier migrations still need `supabase db push` on the hosted project. |
| `OPS-07` | P1 | S | **Monitoring.** Uptime check on the website and the API, alerts on error rate and on AI spend (`AI-06`), a status note for users. |
| `OPS-08` | P2 | S | **Versioning and changelog.** One version number scheme across app, watch app and website; a changelog users can read. |
| `OPS-09` | P1 | S | **Push the branch.** 25 commits are only on one Mac. Push `feat/tracking-platform` in both repos and open pull requests, so the work is backed up and CI runs. |
| `OPS-10` | P2 | S | **Support.** A support address, an in-app "report a problem" that attaches app version and device (no health data), and a short help page. |

---

## 8. Dependencies and updates

Checked with `bun outdated` on 2026-11-17.

| ID | P | Size | Item |
|---|---|---|---|
| `DEP-01` | P1 | S | **Patch updates.** Expo SDK 58 is current; about 25 Expo packages have patch releases (`expo` 58.0.19 → 58.0.25 and others). Run `npx expo install --fix`, then `bun run verify` and a device build. |
| `DEP-02` | P2 | M | **Major versions available, none urgent:** AsyncStorage 3, `react-native-ble-manager` 13, `@hookform/resolvers` 7, `uuid` 14, `react-native-get-random-values` 2, `@testing-library/react-native` 14, ESLint 10, TypeScript 7, Tailwind 4 (NativeWind 4 needs Tailwind 3: don't upgrade until NativeWind supports it). Take them one at a time, each with a device check. AsyncStorage 3 becomes moot after `PERF-02`. |
| `DEP-03` | P1 | S | **Unused or half-installed packages.** `@react-three/fiber` is used by one file; check whether the body viewer needs it or only `three`. Check whether both `uuid` and `expo-crypto` are needed for ids. `eas.json` assumes packages that aren't installed (`OPS-03`). |
| `DEP-04` | P1 | S | **Automate.** Renovate or Dependabot on both repos, grouped weekly, with CI as the gate. |
| `DEP-05` | P2 | S | **Website.** Next.js 16.4 and Supabase packages are current at the time of the check. Pin exact versions (most are) and keep the `AGENTS.md` note: this Next.js version differs from older documentation. |

---

## 9. Product completeness

### Android

| ID | P | Size | Item |
|---|---|---|---|
| `AND-01` | P0 | M | **Build it once.** `bun run android` has not been run on this branch. Expect config issues (the Android package is `com.spotme.app`, iOS is `com.damianoshushku.spotme`: decide on one naming), then run the device test pass. |
| `AND-02` | P1 | L | **Feature parity decisions.** iPhone-only today: Apple Watch, HealthKit, Live Activity, Motion Lab tracker, Apple Music. Android equivalents: Wear OS app (large), Health Connect, an ongoing notification with the timer (the Android counterpart of a Live Activity), ML Kit pose detection for Motion Lab, media session (already written, untested). Decide which ship in version 1. |
| `AND-03` | P1 | M | **Health Connect** for heart rate and for writing workouts, with its Play declaration. |
| `AND-04` | P1 | S | **Android basics.** Predictive back is disabled in `app.json`; edge-to-edge and the 16 KB page-size requirement need checking with every native library. |

### App features and polish

| ID | P | Size | Item |
|---|---|---|---|
| `PROD-01` | P1 | M | **Onboarding.** Goals, units, experience level, equipment, consent (`PRIV-01`), health permissions asked in context, a sample workout. This is also where the AI gets its starting facts. |
| `PROD-02` | P1 | M | **Reminders.** Local notifications exist for timers only. Add workout reminders from the weekly plan, a weigh-in nudge, and (with a paid developer account) push for messages from a professional. |
| `PROD-03` | P1 | M | **Progress views.** Per-exercise history and charts (estimated one-rep max exists in code but has no screen), personal records, volume by muscle over weeks, body measurements over time, photo progress (stored on device only). |
| `PROD-04` | P1 | M | **Workout library depth.** Templates and programmes (multi-week plans with progression), supersets and circuits in the editor and player, warm-up sets, RPE or reps-in-reserve entry on each set (the fatigue model already uses RPE when present, but the player doesn't ask for it), rest timer presets, plate calculator. |
| `PROD-05` | P1 | M | **Nutrition depth.** Saved meals and recipes, copy a day, favourites, water, fibre and micronutrients where the database has them, targets by day type (training or rest), a weekly view. Grocery-aware search is already on the roadmap. |
| `PROD-06` | P1 | S | **Home screen and Lock Screen widgets.** The Live Activity target can also host widgets: today's workout, calories left, weight trend. |
| `PROD-07` | P1 | S | **Apple Health, both ways.** Read weight, body fat, sleep and resting heart rate; write weight and nutrition as well as workouts. Sleep and resting heart rate would also make the fatigue estimate less of a guess. |
| `PROD-08` | P2 | M | **Sync Motion Lab** results to the backend and show them on the website; link a recording to a logged set. |
| `PROD-09` | P2 | S | **Appearance.** Dark only today. Add a light theme and follow the system setting; add iPad layout or keep iPad off deliberately. |
| `PROD-10` | P2 | M | **More languages**, with the text check already in CI. Add a translation review step: Italian was written alongside English, not reviewed by a second native reader. |
| `PROD-11` | P1 | M | **Monetisation decision.** Free, subscription or one-time. AI has a running cost per user (section 10), so the answer shapes the AI plan. In-app purchase needs StoreKit and Play Billing (RevenueCat is the usual shortcut), restore purchases, and store review of the paywall. |
| `PROD-12` | P2 | M | **Social and sharing.** Share a workout summary image, share a workout plan by link, follow friends. Optional; each adds privacy work. |
| `PROD-13` | P1 | S | **Empty, loading, error and offline states** on every screen. Several screens assume data exists and the network works. |
| `PROD-14` | P2 | S | **Data import** from other apps (CSV from Strong, Hevy, MyFitnessPal) to lower the cost of switching. |

---

## 10. AI implementation plan

### What the AI should do

Four jobs, from least to most open-ended. Ship them in this order.

1. **Fill in for typing.** "Chicken and rice, about 200 g each" becomes a food entry; a photo of a meal becomes an estimate to confirm; "bench 3 by 8 at 60" becomes logged sets.
2. **Explain the user's own data.** A weekly review: what changed in weight, volume, fatigue, execution, food, and one or two things to do about it.
3. **Plan.** Build or adjust a workout plan from goals, equipment, available days, fatigue and Motion Lab's machine fits; suggest rest days and deloads; suggest calorie and protein targets around hard sessions.
4. **Coach in conversation.** Answer questions with the user's data in view, and act through the app (create the workout, set the target) after confirmation.

### Architecture

| ID | P | Size | Item |
|---|---|---|---|
| `AI-01` | P0 | M | **A server in the middle.** The AI provider's key must never be in the app. Add a Supabase Edge Function (`/functions/v1/coach`) that checks the user's session, builds the request, calls the AI provider and streams the answer back. Edge Functions allow 150 seconds of run time on the free plan and 400 on paid, and 2 seconds of CPU per request, which fits streaming a chat answer; long jobs (weekly reviews for all users) should run as scheduled batch jobs instead. |
| `AI-02` | P0 | M | **Context from data, not from the conversation.** The server builds a compact profile for each request from the database: goals and preferences, the last weeks of weight, the week's training volume, `fatigueForAi()`, `motionForAi()`, recent food totals, the active plan. Keep it under a few thousand tokens and stable in order, so it can be cached. Today those two functions run on the phone on local data: move their logic into a shared package or SQL so the server can run them. |
| `AI-03` | P0 | S | **Consent and disclosure.** Before the first AI use: a screen naming the AI provider, what data is sent (list it), what it's used for, that it isn't used to train models (confirm in the provider's terms), and how to turn it off. Store the consent. Without it the AI features stay off and the rest of the app works. This satisfies Apple 5.1.2(i) and is part of the GDPR consent in `PRIV-01`. |
| `AI-04` | P1 | M | **Tools, not free text, for actions.** Define functions the model can call, executed by the server with the user's permissions: read (`get_sessions`, `get_food_day`, `get_body_history`, `get_fatigue`, `search_exercises`, `search_food`) and write (`create_workout`, `update_workout`, `log_food`, `set_targets`, `schedule_workout`). Every write is a proposal the user confirms in the app before it's saved. Use strict tool schemas so calls always match. |
| `AI-05` | P1 | S | **Structured results.** For plans, food parsing and weekly reviews, ask for JSON that matches a schema (the provider's structured outputs guarantee valid JSON for a given schema) and validate it again with zod before showing or saving. The app renders plans with its own components, never as raw text. |
| `AI-06` | P0 | S | **Cost and abuse controls.** Per-user daily and monthly limits enforced on the server, a hard monthly budget with an alert, request size limits, rate limiting, and later device attestation (`SEC-08`). Log tokens per request per feature. |
| `AI-07` | P0 | M | **Guardrails.** In the instructions and tested: fitness and nutrition coaching only; no diagnosis, no medication or supplement dosing, no advice on injuries beyond "see a professional"; careful handling of signs of disordered eating (no aggressive deficits, no praise for extreme restriction, point to help); minimum calorie floors; no advice for under-18s if the app excludes them; say when data is missing instead of guessing. A member with a professional attached: the AI defers to the professional's targets. |
| `AI-08` | P1 | M | **Evaluation set.** 100 or more test conversations with expected behaviour: the plan fits the stated equipment and days, numbers quoted match the data provided, refusals happen where they should, Italian answers are natural. Run on every change of instructions or model. Without this, quality is a matter of opinion. |
| `AI-09` | P1 | S | **Conversation storage.** Store conversations in the backend under row-level security, with a retention period, included in export and erase (`PRIV-06`). Let the user delete a conversation. Keep a small "what the coach knows about me" note the user can read and edit, rather than hidden memory. |
| `AI-10` | P1 | S | **Label everything AI-made** (`STORE-14`), and let the user report a bad answer with one tap (stored for review, with consent). |
| `AI-11` | P2 | M | **On-device first where it's enough.** Fatigue, volume, execution scoring and machine fit are already computed without AI. Keep it that way: the AI explains and plans, the app measures. It keeps cost down and keeps the app useful offline and without consent. |
| `AI-12` | P2 | M | **Professionals.** An AI summary of a patient's week for the professional, and AI drafts of recommendations the professional approves. Needs the member's separate consent. |

### Model choice and cost

Prices from Anthropic's pricing page on 2026-11-17, per million tokens:

| Model | Input | Output | Cached input read | Suited to |
|---|---|---|---|---|
| Claude Haiku 5.5 | $0.10 | $0.50 | $0.01 | Food text parsing, classification, short tips |
| Claude Sonnet 5.5 | $2 | $10 | $0.10 | Coach conversation, plan building, meal photos |
| Claude Opus 5.5 | $4 | $20 | $0.20 | The hardest planning, if tests show Sonnet falls short |

Other facts that shape the design:
- **Prompt caching.** A repeated prefix (instructions, tool definitions, the user's profile) is billed at a fraction of the input price when re-read within 5 minutes (or 1 hour at a higher write price). The minimum cacheable prefix is 512 tokens on these three models. Put the stable parts first.
- **Batch processing** is half price for work that can wait, such as weekly reviews.
- **Data handling.** Anthropic states API data is not used for training without permission. Zero data retention is a separate arrangement requested through their sales team. The Fable-tier models require 30-day retention, so they are a poor fit for health data if zero retention is the goal.
- **Model lifetimes.** Each model has a published retirement date (not before late 2027 for the current ones). Keep the model name in server configuration, not in the app.

My cost estimates, with the assumptions stated (3,000 tokens of cached instructions and tools, 4,000 tokens of profile and history, 500 tokens of answer):

| Use | Model | Per use | Per active user per month |
|---|---|---|---|
| Coach message | Sonnet 5.5 | about 1.3–2.1 cents | about $0.90 at 60 messages |
| Coach message | Haiku 5.5 | about 0.1 cent | about $0.05 at 60 messages |
| Weekly review (12,000 tokens in, 1,500 out, batch) | Sonnet 5.5 | about 2 cents | about $0.08 |
| Food text to entry (800 in, 200 out) | Haiku 5.5 | about 0.02 cent | about $0.03 at 150 entries |
| Meal photo estimate (about 2,000 in, 300 out) | Sonnet 5.5 | about 0.7 cent | about $0.42 at 60 photos |

So a heavy user of everything in the table costs roughly $1.45 a month, and a light one a few cents. These depend entirely on the assumed sizes; measure real token counts in the first week and redo the table. The choice of provider is open: the same architecture works with any model that supports tool calls and JSON schemas, and `AI-08` is how to compare them.

### Order of work

| Step | What ships | Depends on |
|---|---|---|
| AI-A | Server function, consent screen, limits, logging, guardrail instructions, evaluation set started | `AI-01`, `AI-03`, `AI-06`, `AI-07`, `PRIV-01`, `OPS-01` |
| AI-B | Food text and meal photo to entry; weekly review (read-only AI, lowest risk) | AI-A, `AI-02`, `AI-05` |
| AI-C | Coach conversation with read tools; streaming; conversation storage | AI-B, `AI-04`, `AI-09` |
| AI-D | Write tools with confirmation: build and adjust plans, set targets, schedule rest | AI-C, `AI-08` passing |
| AI-E | Proactive: nudges after a hard week, deload suggestions, machine recommendations from Motion Lab; professionals' summaries | AI-D, `AI-12` |

---

## 11. Roadmap

Each phase ends with something testable. Earlier phases are prerequisites for later ones.

| Phase | Goal | Items |
|---|---|---|
| **A. Make it run** | The app opens, every feature has been tried on a real iPhone and watch, crashes are visible, the work is backed up | `QA-01`, `QA-02`, `QA-03`, `OPS-01`, `OPS-02`, `OPS-09`, `DEP-01`, `PERF-01` |
| **B. Make it safe** | Tokens and health data protected, website hardened, privacy basics in place | `SEC-01`, `SEC-02` with `PERF-02`, `SEC-04`, `SEC-11`, `SEC-12`, `SEC-06`, `PRIV-01` to `PRIV-04`, `STORE-01`, `STORE-06`, `OPS-05`, `OPS-06` |
| **C. Make it solid** | Tests, pipeline, performance, the rest of security | `QA-04` to `QA-06`, `QA-08`, `OPS-03`, `OPS-04`, `OPS-07`, `SEC-03`, `SEC-09`, `SEC-13` to `SEC-20`, `PERF-03` to `PERF-06`, `DEP-03`, `DEP-04` |
| **D. AI, first version** | Consent, server, food entry by text and photo, weekly review | AI-A and AI-B, `STORE-02`, `STORE-14` |
| **E. Android** | Built, tested, with the chosen parity features | `AND-01` to `AND-04`, `STORE-10` to `STORE-13` |
| **F. Product depth** | Onboarding, reminders, progress views, workout and nutrition depth, widgets, Health both ways | `PROD-01` to `PROD-07`, `PROD-11`, `PROD-13` |
| **G. AI coach** | Conversation, then actions | AI-C and AI-D, `AI-08` |
| **H. Beta and store** | TestFlight and Play testing with real users, store material, external security review, launch | `STORE-03` to `STORE-09`, `PRIV-05` to `PRIV-09`, `SEC-21`, `QA-07` |
| **I. After launch** | Proactive AI, professionals' AI, sharing, more languages, imports | AI-E, `PROD-08` to `PROD-10`, `PROD-12`, `PROD-14`, `PERF-07` to `PERF-12` |

The earlier design-doc phases map onto this: grocery-aware food search is part of F (`PROD-05`), the AI layer is D and G, supplements and recovery belong after G (they raise the medical-claims question in `STORE-07`), and "AI everywhere" is I.

---

## 12. What I could not check

- Anything that needs a device: see the table in section 1.
- The hosted Supabase project's settings (auth, backups, region). The findings are from `supabase/config.toml`, which may differ from the dashboard.
- The website copy audited is the one in the working session; confirm it matches the branch on the Mac before acting on file references.
- Legal conclusions. The compliance items describe the rules as published and reported; applying them to SpotMe needs a professional.
- Competitors. The product list in section 9 reflects features common in established training and nutrition apps, from general knowledge, not from a feature-by-feature comparison done for this document.

---

## Sources

App Store and Apple
- [Updated App Review Guidelines (Apple, November 2025)](https://developer.apple.com/news?id=ey6d8onl)
- [Apple's new App Review Guidelines clamp down on apps sharing personal data with third-party AI (TechCrunch)](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)
- [App Review Guideline 5.1.3: health data use and sharing restrictions (ConductAtlas record of Apple's text)](https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/health-data-use-and-sharing-restrictions/)
- [App privacy details on the App Store (Apple)](https://developer.apple.com/support/app-privacy-on-the-app-store)
- [Protecting user privacy in HealthKit (Apple)](https://developer.apple.com/documentation/healthkit/protecting-user-privacy.md)

Google Play
- [Health apps policy (Play Console Help)](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en)
- [Target API level requirements (Android Developers)](https://developer.android.com/google/play/requirements/target-sdk)
- [Publish your health app on Google Play: Health Connect (Android Developers)](https://developer.android.com/health-and-fitness/health-connect/declare-access)

EU rules
- [Not delayed, not deferred: EU AI Act transparency obligations are now in force (Goodwin, August 2026)](https://www.goodwinlaw.com/en/insights/publications/2026/08/alerts-technology-dpc-eu-ai-act-transparency-obligations-now-in-force)
- [Health data under GDPR Article 9 (Legiscope)](https://www.legiscope.com/blog/health-data-article-9-gdpr.html)

Security
- [OWASP Mobile Application Security checklist and MASVS control groups (OWASP Developer Guide)](https://devguide.owasp.org/04-design/03-mas-checklist)

AI and backend
- [Claude models overview (Anthropic)](https://platform.claude.com/docs/en/models/overview)
- [Claude pricing (Anthropic)](https://platform.claude.com/docs/en/about-claude/pricing)
- [Prompt caching (Anthropic)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Structured outputs (Anthropic)](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [API and data retention (Anthropic)](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- [Edge Functions limits (Supabase)](https://supabase.com/docs/guides/functions/limits)
