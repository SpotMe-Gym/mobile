# SpotMe Mobile — Project Comprehension

> **Scope:** `SpotMe-Gym/mobile` (Expo / React Native app), plus the agent rule sets that govern it.
> **Snapshot:** branch head `d9230be` ("fixed dragging issues") + uncommitted changes in the dashboard grid (`app/index.tsx`, `components/dashboard/*`). Written 23 Oct 2026.
> **Companion document:** [`IMPROVEMENT_PLAN.md`](./IMPROVEMENT_PLAN.md) — what to change and in what order.
>
> ⚠️ **This describes the codebase *before* the improvement work.** Most defects in §8 are fixed on branch `chore/improvement-plan`; the up-to-date status table is at the top of the improvement plan, and the current conventions are in `.cursor/rules/`.

---

## 1. What the app is

SpotMe is an **offline-first gym and nutrition tracker** for iOS and Android. Everything lives on the device; there is no backend or user account. The only network dependency is the public **Open Food Facts** API, used for food search and barcode lookup.

| Area | Status | Notes |
|---|---|---|
| Onboarding (bio → goals → macro targets) | ✅ Working | Mifflin-St Jeor BMR × activity multiplier ± goal offset; 30/40/30 macro split with a "lock ratio" toggle |
| Customisable home dashboard | ✅ Working (active development) | Widget grid with edit mode: jiggle, drag-to-reorder, edge/corner resize, add/remove sheet |
| Workout plans | ✅ CRUD | Exercises with sets/reps/rest, up to two timed "execution phases", rest blocks, weekly schedule |
| Today's plan | 🟡 Read-only | Carousel of the day's workouts. **"Start workout" only does `console.log`**; there is no live session or set logging |
| Nutrition logging | ✅ Working | Search (local history + OFF), barcode scan, portion in g/oz, 4 fixed meals per day |
| Body weight | ✅ Working | Log entries, trend vs. previous entry, simple 7-bar chart, delete |
| Units & language settings | ✅ / 🟡 | kg/lbs and cm/ft persisted; EN/IT switch **not persisted** across launches |
| Profile | 🟡 Partial | Stats + reset all data; "Account details" and the settings cog do nothing |
| AI chat / coaching | ⛔ Placeholder | `app/chat.tsx` shows "Coming Soon"; AI buttons on every screen route there |
| Recent activity widget / micronutrients | ⛔ Mock data | Hard-coded "Pull Day / Yesterday" rows and a static micronutrient table |

README roadmap (still open): body-measurement carousel + 3D body model (prototyped separately in `/Humanoide` with a GLB avatar and Three.js page), editing macros from the profile, gradual AI features, and ExerciseDB exercise search.

---

## 2. Technology stack (actual installed versions)

| Concern | Library | Version |
|---|---|---|
| Runtime | Expo SDK | 54.0.31 |
| | React Native (New Architecture **on**) | 0.81.5 |
| | React | 19.1.0 |
| Routing | expo-router (file-based) | 6.x |
| Styling | NativeWind + Tailwind CSS | 4.2 / 3.4.17 |
| Client state + persistence | Zustand `persist` | 5.x |
| Storage engines | react-native-mmkv (v4, `createMMKV`) / AsyncStorage | 4.1 / 2.2 |
| Server-state | @tanstack/react-query | 5.x — **provider mounted, no queries in use** |
| Animation / gestures | Reanimated 4 (+ worklets) / Gesture Handler | 4.1 / 2.28 |
| Lists | @shopify/flash-list | **2.2** (v2 API — see §8) |
| Images | expo-image | 3.x |
| i18n | i18next + react-i18next + expo-localization | 25.8 / 16.5 |
| Forms | react-hook-form + zod | installed, **not used anywhere** |
| Device | expo-camera (barcodes), expo-location, expo-haptics | — |
| Icons | lucide-react-native | 0.562 |
| Tooling | TypeScript 5.9, Bun lockfile, Nix flake dev shell (`.envrc` → `use flake`) | — |

**Native projects:** `ios/` and `android/` exist locally but are git-ignored, so the project follows Expo's **Continuous Native Generation** model (`expo prebuild`). `app.json` is the source of truth for native config.

**Not present:** ESLint, Prettier, unit/component/E2E tests, CI, `eas.json` (EAS Build/Update), crash reporting, analytics, error boundaries, `strict` TypeScript.

---

## 3. Repository layout

```
SpotMe-Gym/
├── .agent/rules/            ← Antigravity rules (see §4)
│   ├── mobile.mdc
│   └── yourfile.mdc
├── Humanoide/               ← standalone 3D avatar prototype (Python Blender script + HTML/Three.js + GLB)
└── mobile/                  ← the app (its own git repo)
    ├── .cursor/rules/*.mdc  ← 12 Cursor rule files (see §4)
    ├── app/                 ← Expo Router screens
    │   ├── _layout.tsx      root Stack, providers, onboarding redirect
    │   ├── index.tsx        Home dashboard
    │   ├── onboarding.tsx   3-step wizard
    │   ├── chat.tsx         AI placeholder
    │   ├── profile/index.tsx
    │   ├── settings/{units,language}.tsx
    │   ├── workouts/{index,create,today}.tsx
    │   ├── nutrition/{search,detail}.tsx, product/[code].tsx
    │   └── body-weight/index.tsx
    ├── components/
    │   ├── ui/              Button, Card, Icon (primitives)
    │   ├── dashboard/       widget grid system (catalog, cells, drop/resize logic, add sheet)
    │   ├── nutrition/ body-weight/ workouts/ onboarding/   feature components
    │   ├── ExpandableCardLayout.tsx   card→fullscreen transition shell
    │   ├── ScreenHeader.tsx
    │   └── TabBar.tsx       ← dead code (tabs were removed)
    ├── hooks/               expandable card, hydration, today's workouts, unit conversion
    ├── store/               userStore, workoutStore, nutritionStore, dashboardStore
    ├── services/foodService.ts   Open Food Facts client
    ├── i18n/                init + locales/en.json, it.json
    ├── lib/                 cn(), haptics wrapper
    └── utils/unitConversion.ts
```
~7,000 lines of TS/TSX. Largest files: `app/workouts/create.tsx` (601), `components/dashboard/WidgetCell.tsx` (405), `app/nutrition/search.tsx` (333).

---

## 4. The rule sets

Two independent rule systems target this codebase. They overlap heavily but are not identical, and some rules no longer match the installed library versions.

### 4.1 Antigravity rules — `/.agent/rules/`

**`mobile.mdc`** — "Senior React Native Engineer Guidelines" (globs: `mobile/**`, `**/*.tsx`, `**/*.ts`, `app/**`)

1. **Stack & architecture** — Expo Router only; Zustand for global client state and TanStack Query for async server state; NativeWind *or* `StyleSheet.create`, **no inline styles**; forms with `react-hook-form` + `zod`.
2. **Coding standards** — strictly typed components, avoid `any`, interfaces for all props; functional components split into `components/`; absolute imports via `@/`.
3. **Performance** — always `@shopify/flash-list` for long lists; `expo-image` instead of RN `<Image>`; prefer JSI libraries (MMKV) over async-bridge ones.
4. **UI/UX** — follow Apple HIG and Material Design 3; touch targets ≥ **44×44 pt**; support **Dark Mode automatically from the system**.

**`yourfile.mdc`** — a single persona sentence ("Senior React Native Engineer and UI/UX Designer… scaffold a high-performance mobile application for gym and nutrition tracking"). Placeholder filename, no frontmatter.

> ⚠️ **Format issue:** `mobile.mdc`'s frontmatter is fenced with `--------` (8 dashes) instead of `---`, so tools that parse YAML frontmatter will likely treat it as body text and ignore the `globs`/`description`. `yourfile.mdc` has no frontmatter at all.

### 4.2 Cursor rules — `mobile/.cursor/rules/` (summary)

| File | Key directives |
|---|---|
| `agent-instructions` *(alwaysApply)* | Direct, no fluff; surgical edits; preserve logic; "why" comments; ask when context is missing; flag rule conflicts; plan multi-file changes first |
| `react-native` | Declares SDK 54 / RN 0.81 / New Arch; FlashList, expo-image, safe-area hooks, no `useEffect` fetching; folder structure; Android `window` vs `screen` dims; `collapsable={false}`; edge-to-edge insets; expandable-card route config (`transparentModal` + `animation: 'none'`); atomic Zustand selectors; **MMKV for small prefs, AsyncStorage for larger data**; bump `version` + `migrate` on shape change; NativeWind first; `Icon` wrapper; `SafeAreaView edges={['top']}` |
| `code-standards` | Strict TS, `unknown` over `any`; file ordering & naming; `React.memo`/`useCallback`/`useMemo` rules; **Zustand = UI state only, TanStack Query = server state, never duplicate**; immutable updates; functional `setState`; try/catch + `Alert.alert` for user errors; import ordering |
| `animations` | Reanimated only (never RN `Animated`); standard durations (open 350 ms, close 250 ms, press spring d15/s400); `useReducedMotion`; full documentation of the expandable card system; `runOnJS` safety |
| `advanced-performance` | `InteractionManager.runAfterInteractions` after heavy animations; cleanup all timers/listeners; no `moment`, no `JSON.parse(JSON.stringify())`; isolate high-frequency state in leaf components |
| `data-fetchin` | Never fetch in `useEffect`; hierarchical `as const` query-key factories; queries/mutations wrapped in custom hooks; invalidate or optimistic-update on mutation |
| `forms-and-validation` | RHF + zod + `zodResolver`; `z.infer` types; `Controller` for custom inputs; New-Arch-safe input formatting |
| `image-and-media` | expo-image only, explicit dimensions, blurhash placeholders, `contentFit`, transitions |
| `language-i18n` | **Zero hard-coded user-facing strings**; hierarchical keys; interpolation (no concatenation); plural suffixes; encouraging, non-technical tone |
| `list-performance` | FlashList for all lists; `estimatedItemSize`; `getItemType`; memoised `renderItem` + `React.memo` rows |
| `storage-management` | MMKV only for small sync KV; AsyncStorage/SQLite for unbounded data; **never one giant JSON array under one key**; chunk or use SQLite; always `version` + `migrate`; gate UI on hydration; optimistic offline mutations |
| `ui-ux-design` | No raw hex — use theme tokens (`bg-primary`, `text-muted-foreground`…); 4-pt grid, no arbitrary values; WCAG AA contrast; **tap targets ≥ 48 px**; `accessibilityLabel` on icon-only buttons; roles; purposeful haptics |

### 4.3 Where the rule sets disagree or are stale

| Topic | Antigravity | Cursor | Reality / resolution needed |
|---|---|---|---|
| Expo version | "SDK 50+, Router v3" | SDK 54 | Installed: SDK 54, Router **6** |
| Touch targets | 44×44 pt (Apple HIG) | 48×48 px (Material) | Pick one: use **44 pt iOS / 48 dp Android**, or 48 everywhere |
| Dark mode | "Support automatically from system" | — | `app.json` forces `userInterfaceStyle: "dark"`; app is dark-only |
| Inline styles | Forbidden | `StyleSheet` allowed "for dynamic styles" | Codebase uses many inline `style={{…}}` objects |
| Storage | Prefer JSI (MMKV) | MMKV small / AsyncStorage large | Cursor version is more precise; Antigravity's is easy to misread as "MMKV for everything" |
| FlashList `estimatedItemSize` | — | "Always provide" | **Removed in FlashList v2** — causes TypeScript errors (§8) |
| Theme tokens | — | Use `bg-primary`, `text-muted-foreground`, `border-border` | **Those tokens don't exist**: `tailwind.config.js` only defines `background`, `card`, `text`, `textSecondary` |
| "Strict mode is enabled" | — | Stated as fact | `tsconfig.json` does **not** enable `strict` (Expo's base doesn't either) |
| Server vs client state | Query for server state | "Never put server data in Zustand" | The app has **no server**; workouts/meals/weights are user-owned local data, so Zustand persist is legitimate. The rule needs an explicit "local-first domain data" clause |

---

## 5. Architecture

### 5.1 Boot & navigation

`index.ts` → `expo-router/entry` → `app/_layout.tsx`:

```
GestureHandlerRootView
└─ SafeAreaProvider
   └─ I18nextProvider
      └─ QueryClientProvider (unused)
         └─ Stack (headerShown: false, bg #0A0A0A)
```

- **Onboarding guard:** a `useEffect` watches `hasCompletedOnboarding` + `segments` and `router.replace`s between `/onboarding` and `/`. The layout renders `null` for the first frame (`isMounted` flag).
- **Single Stack, no tabs.** Presentation per route:

| Route | Presentation |
|---|---|
| `index`, `onboarding`, `profile/index`, `settings/*` | card (default push) |
| `workouts/index`, `workouts/create`, `nutrition/search` | `fullScreenModal` |
| `nutrition/detail`, `body-weight/index`, `workouts/today` | `transparentModal`, `animation: 'none'` → **expandable card** |
| `chat` | `modal` |
| `nutrition/product/[code]` | default; receives the whole product as a JSON `initialData` param |

### 5.2 State & persistence

| Store | Engine | Persist `version` | Contents | Notes |
|---|---|---|---|---|
| `userStore` | MMKV (`user-storage`) | **none** | profile, units, activity/goal, macro targets, **full `weightHistory` array** | No migration path; unbounded array in sync storage |
| `dashboardStore` | MMKV (`dashboard-storage`) | 3 | ordered widgets `{id, size}` | Best-practice example: sanitising migrations, registry validation |
| `workoutStore` | AsyncStorage (`workout-storage`) | 4 | `workouts[]`, `schedule` keyed by **English day names** | Seeded with 2 demo workouts; migrations use `any` |
| `nutritionStore` | AsyncStorage (`nutrition-storage`) | 1 | `logs` keyed by `YYYY-MM-DD`, `knownFoods` history map | Entire history in one JSON blob |

Hydration is exposed through `useHasHydrated(store)` (a `useSyncExternalStore` wrapper over `persist.hasHydrated`). AsyncStorage stores gate UI on it; MMKV stores hydrate synchronously.

Selectors are mostly atomic (`useStore(s => s.x)`), in line with the rules. `getDailyTotals` / `getWorkoutsForDay` are store *methods* called during render rather than selectors.

### 5.3 Data flow — nutrition

```
search.tsx ── local knownFoods filter ─┐
          └─ foodService.searchFood ───┴─► merged FoodProduct[] ─► FlashList
barcode ──► knownFoods[code] ?? getFoodByBarcode
tap item ─► router.push(product/[code], { initialData: JSON.stringify(product) })
product/[code].tsx ─► amount × per-100g ─► addFood(todayUTC, meal, scaledItem) ─► nutritionStore
                                                         └─► knownFoods[code] = scaledItem  (⚠ see §8)
```
`foodService` calls `world.openfoodfacts.org` directly with `fetch`, returning `[]`/`null` on any error. Country filter comes from GPS reverse-geocoding (requested every time the search screen mounts) or the device locale.

### 5.4 Signature UI system 1 — Expandable cards

The defining interaction: a home card grows into a full-screen detail page and shrinks back.

1. `useExpandableNavigation` (on the home cell) — press-scale spring, `measureInWindow`, un-scales the measured rect, rounds to whole pixels, pushes the detail route with `cardX/Y/Width/Height` + `widgetSize` params. A module-level 150 ms lock prevents double opens.
2. `useExpandableCard` (on the detail screen) — computes scale/translate from the params against **module-level** `Dimensions.get('window')`, animates `progress` 0→1 (350 ms out-cubic) and back (250 ms), then `runOnJS(router.back)`. Honours `useReducedMotion`.
3. `ExpandableCardLayoutWithContext` — backdrop, morphing container, a **preview layer** (the exact same card component rendered at the closed size and counter-scaled) that fades out at 0.4→0.7, and the **detail layer** that fades in at 0.35→0.65. Android edge-to-edge gets a measured Y offset (shared value) and a bottom fill below the window.

Preview and grid card share components (`NutritionCardContent`, `BodyWeightCardContent`, `TodaysPlanCardContent`) so they can't drift.

### 5.5 Signature UI system 2 — Dashboard widget grid

- **Catalog** (`components/dashboard/catalog.ts`): each widget is a `WidgetDefinition` — `id`, `kind` (`card` | `action`), `category`, supported `sizes`, `defaultSize`, `titleKey`, optional `detailPath`, `gestureMode` (`wrapper` = cell handles the press; `inner` = the widget handles its own presses), and a `Render` component. Registered: `bodyWeight`, `todaysPlan`, `nutrition`, `recentActivity` (cards) + `logMeal`, `addWeight` (actions).
- **Sizing** (`widgetSizes.ts`): 2-column unit grid, 16 pt gap; `half`/`compact` = 1 square column, `full` = 2 columns × 1 unit high; actions are 56 pt bars. `snapSize` picks the nearest size after a resize gesture.
- **Edit mode** (`WidgetCell.tsx`): long-press → jiggle (disabled under reduced motion), remove badge, pan-to-move with `findDropTarget` (≥50 % coverage, normalised by the smaller rect, frames frozen at drag start), 48 pt edge strips + 56 pt corner for resize, `LinearTransition` reflow. Scroll is disabled while dragging.
- Persisted in `dashboardStore` with sanitising migrations.

### 5.6 Internationalisation

`i18n/index.ts` initialises i18next synchronously with the device language (`expo-localization`) and `fallbackLng: 'en'`. Locales: `en.json` (171 keys), `it.json` (53 keys — **118 keys missing**, so most of the Italian UI falls back to English). Language changes are in-memory only.

### 5.7 Styling & design language

Dark, high-contrast, iOS-flavoured: zinc greys (`#0A0A0A` background, `#18181b` cards, `#27272a` borders), blue-600 primary, orange/yellow/red macro colours, rounded-2xl/3xl cards, heavy/italic display type ("SPOTME"). Primitives: `Button` (7 variants × 4 sizes, default `hitSlop` 10), `Card`, `Icon` (lucide wrapper with `pointerEvents="none"`), `ScreenHeader`. Haptics via `lib/haptics.ts`, which safely `.catch`es the native promise.

---

## 6. Rule-compliance snapshot

| Rule | Status | Evidence |
|---|---|---|
| Expo Router file-based routing | ✅ | `app/` |
| Reanimated only, `collapsable={false}`, reduced motion | ✅ | Expandable card, `WidgetCell`; exception: `LayoutAnimation` in `MacroCarousel` (allowed with the Android flag) |
| Atomic Zustand selectors | ✅ mostly | — |
| expo-image instead of RN Image | ✅ | search, product |
| Persist `version` + `migrate` | 🟡 | dashboard ✅, workout ✅, nutrition ✅, **user ❌** |
| Hydration gating | 🟡 | workouts & nutrition ✅; `BodyWeightCardContent` reads MMKV (sync) so OK |
| FlashList for lists | 🟡 | Used in 4 places; `ScrollView` + `.map` for weight history, meal list, exercise editor, today's exercises |
| `@/` absolute imports | 🟡 | Mixed; deep `../../../` relative imports in `app/` |
| No `any` / strict TS | ❌ | `strict` off; 11 `any`s; **12 `tsc` errors** |
| TanStack Query for network | ❌ | `useState` + manual `async` in search; `QueryClient` unused |
| RHF + zod forms | ❌ | Not used in onboarding, workout editor, weight modal, product amount |
| Zero hard-coded strings | ❌ | `chat.tsx`, `MacroCarousel`, `AddWeightModal`, `WeightChart`, workout editor/today screens, meal names, `kcal` |
| Theme tokens, no raw hex | ❌ | **101 hex literals**, 32 arbitrary `[..px]` values; required tokens undefined |
| a11y labels on icon-only buttons | ❌ | 22 icon-only buttons, 10 labels in the whole app |
| Touch targets ≥ 44/48 | 🟡 | `Button size="icon"` is 40 pt (rescued by `hitSlop`); several `h-8 w-8` targets |
| No inline styles (Antigravity) | ❌ | Common, e.g. card content shells |
| Cleanup timers | 🟡 | `create.tsx` hide-timer not cleared on unmount |

---

## 7. How to run

```bash
cd mobile
direnv allow          # or: nix develop   (Bun, Node 20, JDK 17, Android SDK 36, NDK 27)
bun install
bun run ios           # expo run:ios   (dev build — native modules like MMKV need it; Expo Go won't work)
bun run android       # expo run:android
bun run prebuild:clean  # regenerate ios/ and android/ from app.json
```
Type-check: `npx tsc --noEmit` (currently 12 errors).

---

## 8. Known defects found during analysis

Verified by reading the code and running `tsc`. Fixes are in the improvement plan.

**Data correctness**
1. **Day boundary uses UTC.** `new Date().toISOString().split('T')[0]` (5 places) picks "today". In Italy, food logged between 00:00 and 01:00/02:00 local time goes to *yesterday*; same for weight entries.
2. **Food history is double-scaled.** `addFood` stores portion-scaled macros in `knownFoods`, then `historyToProduct` maps them back as *per-100 g* values. Re-adding a food from history or a known barcode computes the wrong calories and macros.
3. **Duplicate food IDs.** A food's `id` is the product barcode, so the same product added twice to a meal shares an ID. Deleting one removes both, and React keys collide.
4. **Weight dates are date-only strings** parsed as UTC midnight and then displayed with hour:minute, so the history list shows a meaningless "01:00/02:00" (and the previous day in negative-offset zones).
5. **Weight trend colour ignores the goal.** A gain is always red, even for users whose goal is "Gain Muscle".
6. **Language choice isn't persisted.** It reverts to the device language on every launch.

**Type / build health** (`tsc --noEmit` → 12 errors)
- 6× FlashList v2 API mismatch (`estimatedItemSize` removed; `FlashList<T>` used as a ref type instead of `FlashListRef<T>`).
- 3× Reanimated 4 transform typing in `useExpandableCard` / `WidgetCell`.
- `i18n/index.ts`: `compatibilityJSON: 'v3'` isn't valid in i18next 25, so v3-style plural handling silently doesn't apply.
- `app/chat.tsx` imports `../../components/ScreenHeader` (wrong depth; only survives because the unused import is elided).
- `components/TabBar.tsx` is dead code referencing an un-declared `@react-navigation/bottom-tabs`.

**UX / behaviour**
- Home header date is hard-coded ("Monday, Jan 19").
- Workout editor: the Save button starts invisible and fades out after 3.5 s, but stays **tappable while invisible**. Execution-phase time inputs are uncontrolled (`defaultValue`), so they show stale values after a phase shift.
- `today.tsx` calls `setActiveIndex` on every scroll frame, re-rendering the whole screen at ~60 Hz.
- Offline food search returns `[]`, so users see "No results found" instead of a connectivity message.
- Location permission is requested every time the food search opens, just to derive a country code.
- `addWeight` quick action opens `/body-weight` without card params, so the expand animation starts from a hard-coded fallback rectangle.
- Module-level `Dimensions.get('window')` in the expandable card and chart doesn't react to iPad split view or rotation, although `supportsTablet: true`.
- Weight chart labels show unrounded floats in lbs (e.g. `176.3699…`).
- Workout schedule keys and labels are English day names (`'Monday'.substring(0,3)`), so they aren't localisable.

**Config**
- iOS deployment target conflict: `ios.deploymentTarget: "15.1"` vs `expo-build-properties` → `16.0`.
- Microphone permission declared but no audio or video recording exists (App Review risk).
- Android adaptive icon background is `#ffffff` on a dark-only app.
- `package.json` name is `temp-app`; two dev dependencies pinned to `"latest"`; `react-native-worklets` used transitively but not declared; `babel.config.js` adds `react-native-reanimated/plugin` although `babel-preset-expo` (SDK 54) already injects the worklets plugin.
