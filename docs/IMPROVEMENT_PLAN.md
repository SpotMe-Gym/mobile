# SpotMe Mobile — Improvement Plan

> **Input:** [`PROJECT_COMPREHENSION.md`](./PROJECT_COMPREHENSION.md) (architecture, rule inventory, defect list).
> **Basis:** the project's own rules (Antigravity `.agent/rules` + Cursor `.cursor/rules`) plus current mobile best practice for Expo SDK 54 / React Native New Architecture: platform HIG / Material 3, WCAG 2.2 for mobile, offline-first data, CNG + EAS delivery, and test pyramid.
> **Written:** 23 Oct 2026, against head `d9230be`.

## Implementation status — 24 Oct 2026 (branch `chore/improvement-plan`)

Scope agreed: every code-level item; SQLite, Sentry and EAS Update only scaffolded. Verified on the branch: `tsc --noEmit` **0 errors** (strict + `noUncheckedIndexedAccess`), ESLint **0 problems**, Jest **49/49**, i18n parity **277 keys × 2**, `expo-doctor` **18/18**, `expo export --platform ios` bundles. Not yet run on a device or simulator.

| Item | Status | Notes |
|---|---|---|
| P0-1 Local day keys | ✅ | `utils/date.ts`, `useToday()`; tested in Europe/Rome |
| P0-2 Per-100 g food model | ✅ | `nutritionStore` v2; legacy history refs keep identity and re-fetch nutrition by barcode |
| P0-3 Unique entry IDs | ✅ | |
| P0-4 Locale decimals | ✅ | `parseDecimal`, `NumberField` |
| P0-5 Persisted language | ✅ | `system` / `en` / `it` in `userStore` |
| P0-6 Save button | ✅ | Sticky footer + unsaved-changes guard |
| P0-7 Small bugs | ✅ | All six |
| P1-1 Strict TS | ✅ | Typed routes and typed i18n keys on |
| P1-2 Lint/format | 🟡 | ESLint + Prettier done; pre-commit hooks and inline-style/colour lint plugins not added (zero hex/arbitrary values verified by grep instead) |
| P1-3 Tests | 🟡 | Unit, migration, store and component tests; Maestro E2E not started |
| P1-4 CI | ✅ | `.github/workflows/ci.yml` (not yet run on GitHub) |
| P1-5 Dependency hygiene | ✅ | Also `expo install --fix` + missing `react-native-svg` peer |
| P1-6 Error handling | ✅ | `ApiError`, route `ErrorBoundary`, `reportError()` |
| P1-7 Protected routes + splash | ✅ | |
| P1-8 `useToday()` | ✅ | |
| P1-9 i18n complete | ✅ | |
| P2-1 Ownership model | ✅ | Written into the rules |
| P2-2 SQLite | ⏸ | Deferred by choice. Weight history moved out of MMKV into an AsyncStorage `weightStore` as a step toward it |
| P2-3 Food API via Query | 🟡 | Done; NetInfo `onlineManager` and query persistence not added |
| P2-4 ISO weekdays | ✅ | `workoutStore` v5 |
| P2-5 Store hygiene + export/erase | ✅ | Export via the system share sheet |
| P2-6 FlashList v2 | ✅ | |
| P2-7 Per-frame renders | ✅ | |
| P2-8 Reactive dimensions | ✅ | `supportsTablet` set to `false` until iPad layouts exist |
| P2-9 React Compiler | ⏸ | Not enabled; evaluate on its own branch |
| P2-11 Tokens | ✅ | `theme/colors.ts` → Tailwind; no `<Text variant>` primitive yet |
| P2-12 Dark mode | ✅ | Option A (dark-only, documented) |
| P2-13 Primitives | ✅ | `Button`, `IconButton`, `ListRow`, `SegmentedControl`, `NumberField`, `Stepper`, `EmptyState`, `Badge` |
| P2-14 RHF + zod | ✅ | Onboarding, workout editor, weight sheet, quick add |
| A-1 … A-7 | ✅ | A-8 (manual VoiceOver/TalkBack pass) is still to do |
| §7 UX | 🟡 | All except `react-native-keyboard-controller` (still on `KeyboardAvoidingView`) |
| S-1 … S-6 | ✅ | GPS removed; mic permission removed; camera explainer; privacy manifest in `app.json` |
| P3-1 Sentry | ⏸ | Hook ready in `lib/reporting.ts` |
| P3-2 Native config | 🟡 | Deployment target fixed; `app.config.ts` not introduced |
| P3-3 EAS | 🟡 | `eas.json` profiles; EAS Update/runtimeVersion need an EAS project id |
| §11 Rules | ✅ | Antigravity frontmatter fixed, `yourfile.mdc` → `persona.mdc`, Cursor rules updated, new `dates-and-numbers.mdc` |

**Beyond the plan — new food entry flow:** a serving-first entry sheet (`app/nutrition/product/[code].tsx`). Units come from the product (serving, g, ml, oz). It has quick-pick chips, switches units without changing the amount, defaults to your last portion, shows live macros against today's remaining targets, and has a meal picker. **Quick add** (`app/nutrition/quick-add.tsx`) logs kcal and macros by hand, can fill in kcal from the macros, and can save the result as a custom food.

## How to read this

Each item has an **ID**, the **problem**, the **best-practice rationale**, the **action**, the **files**, a **done when** criterion and an **effort** (S < ½ day · M 1–3 days · L > 3 days).

| Priority | Meaning |
|---|---|
| **P0** | Users are getting wrong data or broken input today. Fix first. |
| **P1** | Foundations: without these, every later change is riskier. |
| **P2** | Architecture and scale: needed before the next large features (workout sessions, AI, 3D body). |
| **P3** | Polish, release readiness, longer-term. |

A suggested sequence is in [§12 Roadmap](#12-roadmap).

---

## 1. P0 — Correctness & data integrity

### P0-1 · Use the local calendar day, not UTC — **S**
**Problem:** `new Date().toISOString().split('T')[0]` is UTC. In Europe/Rome, anything logged between 00:00 and 01:00/02:00 lands on yesterday. Used in `product/[code].tsx`, `nutrition/detail.tsx`, `NutritionCardContent.tsx`, `AddWeightModal.tsx`, `userStore.ts`.
**Best practice:** a fitness log's "day" is always the user's local civil day. Centralise date logic in one utility so it can be tested.
**Action:** add `utils/date.ts`:
```ts
/** Local civil date as YYYY-MM-DD. Never use toISOString() for day keys. */
export function toDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
/** Parse a YYYY-MM-DD key as local midnight (new Date('YYYY-MM-DD') is UTC). */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
```
Replace all 5 call sites. Render day keys with `fromDayKey(...)` + `toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })` (no hour/minute; fixes the bogus "02:00" in weight history).
**Done when:** a unit test with `TZ=Europe/Rome` at 00:30 returns the local date, and `grep toISOString().split` returns nothing.

### P0-2 · Store foods per 100 g, compute portions separately — **M**
**Problem:** `knownFoods` stores portion-scaled macros, and `historyToProduct` reads them back as per-100 g values, so re-adding from history or a known barcode multiplies twice.
**Action:** split the model:
```ts
interface FoodRef { code: string; name: string; brand?: string; imageUrl?: string;
  per100g: { kcal: number; protein: number; carbs: number; fat: number } }
interface LoggedFood { entryId: string; code: string; grams: number; loggedAt: string;
  // snapshot of computed values so history survives product edits
  kcal: number; protein: number; carbs: number; fat: number; name: string }
```
`knownFoods` holds `FoodRef` (per-100 g). Log entries hold `grams` + computed snapshot. Bump `nutritionStore` to `version: 2` with a migration that drops the corrupted `knownFoods` (they can't be un-scaled reliably without the original amount) and converts `FoodItem` to `LoggedFood`.
**Done when:** adding a food from history shows the same per-100 g values as the API result, with a regression test.

### P0-3 · Unique entry IDs for logged foods — **S** (with P0-2)
**Problem:** the entry ID is the barcode, so the same product twice in one meal can't be deleted individually, and React keys collide.
**Action:** `entryId: uuidv4()` per log entry; `removeFood(date, meal, entryId)`; key `MealList` rows by `entryId`.

### P0-4 · Locale-aware decimal input — **S**
**Problem:** on an Italian iPhone, `keyboardType="decimal-pad"` shows a **comma**. `AddWeightModal`'s regex `^\d*\.?\d{0,1}$` rejects it, so Italian users can't enter `72,5`. `parseFloat('72,5')` also gives `72` in the product amount and onboarding fields.
**Action:** `utils/number.ts` → `parseDecimal(text)` that normalises `,` to `.` and validates. Use it in every numeric field (weight, height, product amount, sets/reps, times). Format back with `Intl.NumberFormat(i18n.language)`.
**Done when:** `72,5` and `72.5` both save 72.5 kg under both locales.

### P0-5 · Persist the chosen language — **S**
**Problem:** `i18n.changeLanguage` is in-memory only; the app reverts on relaunch.
**Action:** persist `language: 'system' | 'en' | 'it'` in `userStore` (MMKV, synchronous, so no flash at boot) and read it in `i18n/index.ts` before `init`. Offer "System default" as the first option.

### P0-6 · Make the workout Save button reliably visible and tappable — **S**
**Problem:** in `workouts/create.tsx` the Save button starts at opacity 0, auto-hides after 3.5 s, and is **still pressable while invisible**. That's a hidden tap target over content.
**Best practice:** a primary action stays persistently visible (HIG / M3). Hiding it on scroll is fine; hiding it at rest isn't.
**Action:** keep it visible at rest and hide only during active scroll; while hidden set `pointerEvents="none"` (via an animated prop or state). Clear `hideTimer` on unmount (rule: advanced-performance). Add a header "Save" action as a second path.

### P0-7 · Small but user-visible bugs — **S** each
| Bug | Fix |
|---|---|
| Home header date hard-coded "Monday, Jan 19" | `new Date().toLocaleDateString(i18n.language, { weekday: 'long', month: 'short', day: 'numeric' })` |
| Weight trend always red on gain | Colour by goal: gain is positive for `Gain Muscle`, negative for `Lose Weight`, neutral for `Maintain` |
| Weight chart labels show unrounded lbs | Use `formatWeightValue` / `Intl.NumberFormat` with `maximumFractionDigits: 1` |
| Exec-phase inputs show stale values after phase shift | Make the time inputs controlled (`value`), or key them by `executionTime` |
| Food search offline → "No results found" | Distinguish errors from empty results (see P1-6) and show "Unable to connect. Please check your internet." (copy rule) |
| `app/chat.tsx` imports `../../components/ScreenHeader` | Fix the path or remove the unused import |

---

## 2. P1 — Engineering foundations

### P1-1 · Turn on strict TypeScript and reach zero `tsc` errors — **M**
**Problem:** the rules say "strict mode is enabled". It isn't (`tsconfig.json` only sets `paths`; Expo's base doesn't enable it), and `tsc --noEmit` already reports 12 errors.
**Action:**
```jsonc
// tsconfig.json
{ "extends": "expo/tsconfig.base",
  "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true, "paths": { "@/*": ["./*"] } },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"] }
```
Then fix: FlashList v2 types (P2-6), Reanimated transform typing (type the arrays as `TransformArrayItem[]` or build with explicit objects), the i18next `compatibilityJSON` option (remove it), delete `TabBar.tsx`, and replace the 11 `any`s (`migrate: (state: unknown)` + type guards; `onLayout: (e: LayoutChangeEvent)`; typed `Href` instead of `as any`). Enable Expo Router **typed routes** (`experiments.typedRoutes: true`) so `router.push` paths are checked.
**Done when:** `npx tsc --noEmit` exits 0 in CI.

### P1-2 · Lint + format — **S**
`npx expo lint` (installs `eslint-config-expo`, flat config) plus Prettier (`prettier-plugin-tailwindcss` sorts classNames). Add rules that **enforce the project rules mechanically**, so agents and humans get the same feedback:
- `no-restricted-imports`: `Image`, `FlatList`, `Animated` from `react-native`; `moment`.
- `react-hooks/exhaustive-deps` as error (several effects currently suppress deps, e.g. `onboarding.tsx`, `useExpandableCard.ts`).
- `@typescript-eslint/no-explicit-any`, `consistent-type-imports`.
- `react-native/no-inline-styles` (warn) and `react-native/no-color-literals` (warn) to drive the token migration (P2-8).
- `i18next/no-literal-string` in JSX (warn → error once IT is complete).
Use `lint-staged` + `husky` (or `lefthook`) pre-commit.

### P1-3 · Test harness — **M**
**Best practice:** a mobile test pyramid with many fast unit tests on pure logic, component tests for screens, and a few E2E flows on real builds.
- **Unit (jest-expo):** `utils/date`, `utils/number`, `unitConversion`, the Mifflin-St Jeor calculator (extract from `onboarding.tsx` to `utils/nutritionTargets.ts`), `dropTarget.findDropTarget`, `widgetSizes.snapSize/nextSize`, every persist `migrate` (feed v0…vN fixtures, assert shape).
- **Component (@testing-library/react-native):** onboarding happy path, add food → totals update, add/delete weight entry, workout create/edit.
- **E2E (Maestro):** onboarding → log a meal → log weight → create workout, on iOS simulator + Android emulator.
**Done when:** `bun test` runs in CI and covers all migrations and calculators.

### P1-4 · CI pipeline — **S**
GitHub Actions on PR: `bun install --frozen-lockfile` → `npx expo-doctor` → `tsc` → `expo lint` → `jest` → i18n key-parity script (P1-9). Later: EAS Build on `main` (P3-3).

### P1-5 · Dependency hygiene — **S**
- Rename `package.json` `name` from `temp-app` to `spotme`.
- Pin `@react-native-community/cli` and `@react-native/metro-config` (currently `"latest"`) or remove them. Expo projects don't need either directly.
- Declare `react-native-worklets` explicitly (`npx expo install react-native-worklets`); it's currently transitive.
- Remove `"react-native-reanimated/plugin"` from `babel.config.js`: `babel-preset-expo` in SDK 54 already injects `react-native-worklets/plugin`. Verify animations after.
- Run `npx expo install --check` after every SDK bump; keep native modules on Expo-compatible versions.
- Delete dead code: `components/TabBar.tsx`, the `hooks/index.ts` barrel if unused, unused imports (`uuid` in `workoutStore`, `Animated`/`interpolate` in detail screens, `ChevronLeft`/`useRouter` in settings).

### P1-6 · Error handling strategy — **M**
**Problem:** `foodService` swallows errors into `[]`/`null`; no route has an error boundary; a render error anywhere white-screens the app.
**Action:**
- Typed results: `throw` from services and let TanStack Query surface `error` (P2-3). Map to user copy: offline, timeout, server, not-found.
- Export `ErrorBoundary` from `app/_layout.tsx` (and from heavy routes) using Expo Router's `ErrorBoundaryProps` (`{ error, retry }`), styled and localised.
- Wrap all store migrations in try/catch with a safe fallback to defaults, and log the failure (never crash on boot because of a bad persisted blob).

### P1-7 · Onboarding guard with protected routes — **S**
Replace the `useEffect` + `isMounted` + `router.replace` dance in `_layout.tsx` with Expo Router's declarative guard:
```tsx
<Stack>
  <Stack.Protected guard={!hasCompletedOnboarding}>
    <Stack.Screen name="onboarding" />
  </Stack.Protected>
  <Stack.Protected guard={hasCompletedOnboarding}>
    <Stack.Screen name="index" /> {/* …all app routes… */}
  </Stack.Protected>
</Stack>
```
This removes the blank first frame and the `setTimeout(() => router.replace('/'), 100)` in `onboarding.tsx`. Keep the native splash visible until fonts/stores are ready with `expo-splash-screen` (`preventAutoHideAsync` / `hideAsync`).

### P1-8 · Single "today" source that survives midnight — **S**
Components compute `today` during render, so an app left open overnight shows yesterday. Add `useToday()`, which returns `toDayKey()`, re-evaluates on `AppState` → `active`, and schedules a timeout to the next local midnight (cleared on unmount). Use it in nutrition, workouts (day of week), and the home header.

### P1-9 · Complete i18n and keep it complete — **M**
- Translate the **118 missing Italian keys** (69 % of the catalogue).
- Move every remaining literal into locales: `chat.tsx`, `MacroCarousel` ("Daily Summary", "Protein", "Carbs", "Fat", micronutrient labels, "Tap arrow to view all"), `AddWeightModal` ("Log Weight", "Weight", "Date", "Save Entry"), `WeightChart`, `CalorieGauge`/product "kcal", workout editor placeholders ("EXECUTION", "ALT. EXECUTION", "m"/"s"), `today.tsx` ("WORKOUT", "Min", "Sets • Reps", "Exec", "Rest"), `workouts/index` ("Ex • min"), and **meal names** (store an enum `breakfast|lunch|dinner|snack` and translate at render).
- Use plurals for counts (`exerciseCount_one/_other`) and interpolation instead of concatenation (`` `${t('food.addTo')} ${meal}` ``).
- Format dates, weekdays and numbers with `Intl` + `i18n.language`; drop hard-coded `'en-US'` (2 places).
- Type the keys: declare `resources` in `i18next.d.ts` (`CustomTypeOptions`) so a missing key is a compile error.
- CI script: fail if `it.json` keys ≠ `en.json` keys.

---

## 3. P2 — Data architecture (local-first, done properly)

### P2-1 · Write down the state ownership model — **S**
The rules say "Zustand only for UI state; server data only in TanStack Query". SpotMe has no server; workouts, meals and weights are **user-owned local domain data**. Make it explicit (and update the rules, §11):

| Kind | Owner | Storage |
|---|---|---|
| Preferences, settings, onboarding flag, dashboard layout | Zustand + `persist` | MMKV (small, sync) |
| Domain records that grow over time: food log, weight log, workout sessions/sets | **Repository over SQLite** (+ thin hooks) | `expo-sqlite` |
| Workout templates & schedule | Zustand + persist now; move to SQLite when sessions arrive | AsyncStorage → SQLite |
| Remote data (Open Food Facts, future ExerciseDB / AI) | TanStack Query | Query cache (optionally persisted) |
| Ephemeral UI state | `useState` / local Zustand slice | memory |

### P2-2 · Move growing histories to SQLite — **L**
**Problem:** the whole nutrition history and food catalogue live in one AsyncStorage JSON blob, and `weightHistory` is an unbounded array in **synchronous** MMKV. Both rules (`storage-management`) forbid this. Every add re-serialises the full history, and boot reads all of it.
**Action:** `expo-sqlite` with a typed query layer (Drizzle ORM + `useMigrations`, or hand-written SQL with a `migrations/` folder). Tables: `food_ref`, `food_log_entry (id, day_key, meal, grams, …)`, `weight_entry (id, day_key, kg, created_at)`, later `workout_session`, `set_log`. Index on `day_key`. Expose repositories (`nutritionRepo.getDay(dayKey)`, `addEntry`, `removeEntry`, `weightRepo.list({ limit })`) and React hooks on top (`useLiveQuery` from Drizzle, or TanStack Query with `queryFn` reading SQLite and invalidation on write; the latter gives you one caching model app-wide).
**Migration:** a one-time importer reads the old persisted blobs, writes rows in a transaction, marks a `migrated_v1` flag, then clears the old keys.
**Done when:** boot time and add-food latency are independent of history size (benchmark with 2 years of seeded data).

### P2-3 · Open Food Facts via TanStack Query — **M**
**Problem:** manual `useState` + async in `search.tsx`; no cancellation, caching, retry, or offline handling; query string not URL-encoded; the whole product is passed through route params (`initialData: JSON.stringify(item)`), so `spotme://nutrition/product/<code>` deep links render nothing.
**Action:**
```ts
// services/foodApi.ts
const OFF = 'https://world.openfoodfacts.org';
const headers = { 'User-Agent': `SpotMe/${Constants.expoConfig?.version} (contact@your-domain)` };
export const foodKeys = {
  all: ['food'] as const,
  search: (q: string, cc: string) => [...foodKeys.all, 'search', { q, cc }] as const,
  product: (code: string) => [...foodKeys.all, 'product', code] as const,
};
export async function fetchProduct(code: string, signal?: AbortSignal) {
  const res = await fetch(`${OFF}/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`, { headers, signal });
  if (!res.ok) throw new HttpError(res.status);
  return productSchema.parse(await res.json()); // zod: never trust remote JSON
}
// hooks/useFood.ts
export const useProduct = (code: string) =>
  useQuery({ queryKey: foodKeys.product(code), queryFn: ({ signal }) => fetchProduct(code, signal),
             staleTime: 1000 * 60 * 60 * 24 });
export const useFoodSearch = (q: string, cc: string) =>
  useQuery({ queryKey: foodKeys.search(q, cc), queryFn: ({ signal }) => searchFood(q, cc, signal),
             enabled: q.trim().length >= 2, staleTime: 1000 * 60 * 10, placeholderData: keepPreviousData });
```
- Debounce the input (300–400 ms) or keep search-on-submit. Open Food Facts publishes strict rate limits for search, so don't fire per keystroke. Send a descriptive `User-Agent` as their API policy asks.
- Product screen takes only `code`. Seed the cache from the search result with `queryClient.setQueryData(foodKeys.product(code), item)` before navigating, so it opens instantly and still works from a deep link.
- Wire `onlineManager` to `@react-native-community/netinfo` and `focusManager` to `AppState` (standard React Native setup for TanStack Query).
- Optional: `@tanstack/query-async-storage-persister` so recent searches and products work offline in the gym.

### P2-4 · Workout schedule keyed by ISO weekday — **S**
`schedule` is keyed by English names (`'Monday'`), and labels come from `day.substring(0,3)`, which can't be localised. Key by ISO weekday `1..7` (Mon = 1), derive labels with `Intl.DateTimeFormat(lang, { weekday: 'short' })`, and respect the locale's first day of week. `workoutStore` → `version: 5` migration maps names to numbers.

### P2-5 · Store hygiene — **S**
- `userStore`: add `version: 1` + `migrate` (currently none, so any shape change will break existing installs). Store `height`/`weight`/`age` as **numbers**, not strings.
- Generate IDs with `uuid` everywhere (`userStore` uses `Date.now() + Math.random().substr`; `substr` is deprecated).
- Replace render-time store methods (`getDailyTotals`, `getWorkoutsForDay`) with selector hooks (`useDailyTotals(dayKey)` using `useShallow` or `useMemo`), so components subscribe to exactly what they read.
- Remove seed workouts from the persisted initial state. Offer them as an explicit "Add sample plan" in the empty state, so new users don't start with someone else's data.
- Add **export / delete my data** (JSON export via `expo-sharing`). Users expect it, and GDPR gives EU users access and erasure rights.

---

## 4. P2 — Performance

### P2-6 · Migrate to the FlashList v2 API and virtualise the remaining lists — **M**
- v2 dropped `estimatedItemSize` (it measures automatically) and the ref type is `FlashListRef<T>`. Remove the prop from all 6 call sites and fix `today.tsx`'s ref. **Update the `list-performance` rule** (§11).
- Virtualise the unbounded lists still rendered with `ScrollView` + `.map`: weight history (`body-weight/index.tsx`) and, once multi-day, the food log. Memoise row components and keep `renderItem` stable (`workouts/index.tsx` currently passes an inline arrow and calls `getWorkoutDays` per row on every render, so precompute a `Map<workoutId, days>` with `useMemo`).
- For a single page that mixes a header, chart and list (body weight, nutrition detail), render **one** FlashList with `ListHeaderComponent` instead of nesting a list in a `ScrollView`.
- The exercise editor (`create.tsx`) is bounded (~5–15 items), so `ScrollView` is acceptable there. Note this as an explicit exception in the rule rather than forcing a list with focused TextInputs.

### P2-7 · Kill per-frame re-renders — **S**
`today.tsx` calls `setActiveIndex` on every scroll event (~60 Hz) and re-renders the entire screen, including the second list. Track the offset in a Reanimated shared value (`useAnimatedScrollHandler`) and derive the dots on the UI thread, or update the index only on `onMomentumScrollEnd` / `onViewableItemsChanged`. Same pattern in `MacroCarousel`.

### P2-8 · Reactive dimensions — **S**
`useExpandableCard`, `ExpandableCardLayout` and `WeightChart` read `Dimensions.get(...)` at **module load**. iPad is enabled (`supportsTablet: true`), so split view or Stage Manager changes the window at runtime, and Android foldables do the same. Use `useWindowDimensions()` inside the hooks and pass the values into worklets. Either decide to support iPad properly (layouts for > 600 pt width) or set `supportsTablet: false` until you do.

### P2-9 · Opt into the React Compiler (evaluate) — **S**
SDK 54 supports the React Compiler (`"experiments": { "reactCompiler": true }` + `babel-plugin-react-compiler`). It auto-memoises components and hooks, which removes most hand-written `useCallback`/`useMemo`/`React.memo` the rules require and the bugs from missing deps. Enable it on a branch, run the E2E suite, and profile the dashboard edit mode. If adopted, simplify the `code-standards` memoisation section.

### P2-10 · Measure, don't guess — **S**
Add a perf checklist to PRs that touch the dashboard/expandable card: React DevTools Profiler (commit counts while dragging), the Reanimated/Perf Monitor overlay on a low-end Android device (target: 60 fps during jiggle/drag, < 16 ms JS frames), `npx expo-atlas` for bundle size, and cold-start time on a release build.

---

## 5. P2 — Design system & UI consistency

### P2-11 · Real design tokens — **M**
**Problem:** the rules mandate tokens like `bg-primary` and `text-muted-foreground`, but `tailwind.config.js` defines only 4 colours. The code has **101 hex literals** and 32 arbitrary `[..px]` values; icon colours (`#3b82f6`, `#71717a`…) are duplicated everywhere.
**Action:**
- Define semantic tokens once in `theme/colors.ts` and feed them to Tailwind (`theme.extend.colors`) **and** to JS for icon props, Reanimated and native config:
  `background, surface, surface-elevated, border, text, text-muted, text-subtle, primary, primary-foreground, danger, success, warning, macro-protein, macro-carbs, macro-fat, ai`.
- Typography scale as Tailwind font-size tokens (e.g. `display / title / headline / body / caption`), with a `<Text variant>` primitive. Minimum rendered size **11 pt**, so remove `text-[8px]`/`text-[10px]`.
- Spacing and radii from the 4-pt grid; replace `rounded-[40px]`, `min-w-[20px]` etc. with tokens.
- Point `tailwind.config.js` `content` at `hooks/` and `lib/` too (classNames built there aren't scanned).
- Migrate screen by screen; the `no-color-literals` lint (P1-2) tracks progress.

### P2-12 · Dark mode decision — **S**
Antigravity says "support Dark Mode automatically from the system"; `app.json` forces `userInterfaceStyle: "dark"`. Pick one:
- **Option A (recommended for now):** stay dark-only and say so in the rules. Set the Android adaptive-icon background and `SplashScreenBackground` to the dark brand colour (currently `#ffffff`).
- **Option B:** with tokens in place (P2-11), add a light palette via NativeWind's `dark:` variant / CSS variables and switch `userInterfaceStyle` to `automatic`.

### P2-13 · Primitives that enforce the rules — **M**
- **`Button`:** default `accessibilityRole="button"`, pass `accessibilityState={{ disabled, busy: loading }}`; icon size 44×44 (iOS) / 48×48 (Android) instead of 40 + `hitSlop`; switch from `TouchableOpacity` to `Pressable` with a pressed style (TouchableOpacity is legacy, and Pressable gives `android_ripple` for Material feedback).
- **`IconButton`:** separate component whose `accessibilityLabel` prop is **required by its TypeScript type**. That makes "icon-only buttons need a label" a compile-time rule; there are 22 icon-only buttons and 10 labels today.
- **`TextField`**, **`NumberField`** (locale decimals from P0-4, unit suffix, min/max), **`SegmentedControl`**, **`ListRow`** (settings rows are copy-pasted 4× in `units.tsx`/`language.tsx`/`profile`).
- Replace `TouchableOpacity` across the 16 files that use it.

### P2-14 · Forms with react-hook-form + zod — **M**
Required by both rule sets, used nowhere. Start with the highest-value forms:
- Onboarding: one zod schema per step (`name` 1–50 chars, `age` 13–100, `height` 100–250 cm, `weight` 30–300 kg), inline field errors instead of a generic `Alert`. Move the target calculator to a pure tested function.
- Workout editor: `useFieldArray` for exercises (add/remove/move are built in); validate sets ≥ 1, rest ≤ 15 min; enables a dirty-state check for P3-2.
- Weight modal and product amount: `NumberField` + schema.

---

## 6. P2 — Accessibility (WCAG 2.2 / platform guidelines)

| ID | Action | Effort |
|---|---|---|
| A-1 | Label every icon-only control (back, AI sparkles, trash, play, +/−, settings cog, scanner close). Use `IconButton` (P2-13). | S |
| A-2 | Roles & states: selected states on day pills, unit/language rows and gender options (`accessibilityState={{ selected }}`); `accessibilityRole="header"` on screen titles; `adjustable` + `accessibilityActions` (increment/decrement) for the age and macro steppers. | S |
| A-3 | **Dynamic Type / font scaling:** test at the largest accessibility sizes. Avoid `adjustsFontSizeToFit` on body text; cap with `maxFontSizeMultiplier` only on dense numeric displays (gauge, big weight number); let cards grow. | M |
| A-4 | **Contrast:** `text-zinc-600` on `zinc-900` (~2.5:1) and `zinc-500` on `zinc-900` for important labels fail AA (4.5:1). Fix via the `text-muted` token. | S |
| A-5 | **Expandable card for screen readers:** when open, set `accessibilityViewIsModal` (iOS) / `importantForAccessibility="no-hide-descendants"` on the underlying screen, move focus to the title (`AccessibilityInfo.setAccessibilityFocus`), and give the backdrop a label ("Close"). | S |
| A-6 | **Dashboard edit mode:** drag and resize are gesture-only. Add accessible alternatives: `accessibilityActions` on each cell (Move up / Move down / Larger / Smaller / Remove). WCAG 2.2 SC 2.5.7 requires a non-dragging alternative. | M |
| A-7 | Colour isn't the only signal: macro bars and the weight trend also carry text/icons (mostly true; keep it so). | S |
| A-8 | Add VoiceOver + TalkBack passes to the release checklist. | S |

---

## 7. P2 — UX completeness

- **Keyboard handling:** `react-native-keyboard-controller` (`KeyboardAwareScrollView`, `KeyboardToolbar` with Next/Done for numeric pads that have no return key) in onboarding, the workout editor and the weight modal. `KeyboardAvoidingView` is imported but unused in `create.tsx`.
- **Unsaved-changes guard:** in the workout editor, use `usePreventRemove` (React Navigation 7) to confirm discarding edits.
- **Empty, loading and error states:** a consistent pattern for each data screen. Skeletons for search results instead of a full-screen spinner that hides the list.
- **Honest placeholders:** don't ship mock data that looks real. Hide or clearly badge "Recent activity" (fake rows), "Micronutrients" (static table), "Premium member", the non-functional Play button, the settings cog and "Account details" until they work.
- **Haptics:** add success feedback on save workout, log meal and log weight (`notificationAsync(Success)`), per the UI rule. Today only edit mode uses haptics.
- **Quick action → detail:** `addWeight` should open the add-weight sheet directly (route param `?add=1`), not the expandable detail from a fallback rectangle.
- **Barcode flow:** show "Searching…" in the camera sheet and allow a retry when not found. Add `torch` toggle for dim gyms.

---

## 8. P2 — Permissions, privacy & security

| ID | Action | Effort |
|---|---|---|
| S-1 | **Location:** requested every time food search opens, just to pick a country. Use the device locale's region (already the fallback) and drop `expo-location` entirely, or ask just-in-time behind an explicit "Use my location for local products" toggle. Fewer permissions mean fewer App Review questions and more user trust. | S |
| S-2 | **Microphone:** no audio/video is recorded, but `NSMicrophoneUsageDescription` and the camera plugin's `microphonePermission` are set. Remove them (expo-camera supports disabling the microphone permission in its config plugin). | S |
| S-3 | **Camera permission UX:** a pre-permission explainer screen before the system prompt; if denied, a button to `Linking.openSettings()`. | S |
| S-4 | **Health data is sensitive.** Keep it on-device by default; if analytics or crash reporting is added (P3-1), scrub weights, foods and names from events. Write a short privacy policy (required by both stores). | S |
| S-5 | **Future AI features:** never embed an LLM API key in the app bundle (it is extractable). Route calls through your own backend or edge function with auth and rate limiting; send only the minimum data needed. | — |
| S-6 | **Privacy manifest:** CNG regenerates `PrivacyInfo.xcprivacy`. Declare required-reason APIs used by MMKV/AsyncStorage (UserDefaults, file timestamps) through `expo.ios.privacyManifests` in `app.json` so they survive prebuild. | S |

---

## 9. P3 — Observability & delivery

### P3-1 · Crash & error reporting — **S**
`@sentry/react-native` with the Expo config plugin: source maps uploaded on EAS Build, release + dist tied to app version, breadcrumbs for navigation, PII scrubbing (S-4). Report store-migration failures and API errors as handled exceptions.

### P3-2 · Native config cleanup — **S**
- Fix the iOS deployment-target conflict: keep `expo-build-properties` → `16.0` (or whatever you choose) and remove `ios.deploymentTarget: "15.1"`.
- Move to `app.config.ts` for environment-specific values (bundle id suffix, API base URLs, Sentry DSN via EAS env vars).
- Set `ios.buildNumber` / `android.versionCode` via EAS `autoIncrement`.
- Decide `predictiveBackGestureEnabled` (Android 14+ users expect it; the expandable card needs a back handler that runs `handleClose` first, via `BackHandler` or `usePreventRemove`).

### P3-3 · EAS Build, Submit and Update — **M**
- `eas.json` profiles: `development` (dev client, internal), `preview` (internal distribution / TestFlight), `production` (store).
- **EAS Update** for OTA JS fixes, with `runtimeVersion: { policy: "fingerprint" }` so an update never reaches a binary with mismatched native code; channels per profile.
- CI: build `preview` on merges to `main`, `production` on tags; `eas submit` to TestFlight / Play internal track.

### P3-4 · Release checklist — **S**
Store assets (icons for dark backgrounds, screenshots in EN + IT), privacy policy URL, data-safety form (Play) and privacy nutrition labels (App Store), accessibility pass (A-8), perf pass on low-end Android (P2-10), migration test from the last released build's data.

---

## 10. P3 — Readiness for the roadmap features

| Feature | Prerequisites from this plan | Best-practice notes |
|---|---|---|
| **Live workout session** (the missing "Start workout") | P2-2 (SQLite `workout_session`, `set_log`), P1-8, P2-14 | Model it as an explicit state machine (idle → exercise → rest → … → summary). Timers must be **timestamp-based** (store `startedAt`, derive remaining time) because `setInterval` counters drift and stop in the background. Keep the screen on with `expo-keep-awake`, schedule the rest-end alert with `expo-notifications`, and consider a Live Activity / ongoing notification later. Isolate the ticking clock in a leaf component (advanced-performance rule). |
| **Progress history & charts** | P2-2 | Query aggregates in SQL; use a real chart library (`victory-native` on Skia, or `react-native-gifted-charts`) instead of the View-based bar chart. |
| **Exercise search (ExerciseDB)** | P2-3 pattern | Same query-key/cache pattern; cache the catalogue for offline use; check the API's licence and rate limits. |
| **3D body model** (`/Humanoide`) | P2-8, perf budget | Render with `@react-three/fiber/native` + `expo-gl`, or a lazy-loaded WebView for the existing Three.js page as a first step; lazy-load the GLB, compress it (Draco/meshopt), and gate it behind a device-capability check. |
| **AI coaching** | S-5, P1-6, P2-3 | Server-side proxy; stream responses; store chat history in SQLite; disclose AI use; never present nutrition advice as medical (the onboarding already has a "non-medical suggestion" string, so reuse that tone). |
| **Apple Health / Health Connect** | P2-2, S-4 | Sync weight and workouts through a single repository layer so both directions dedupe by source ID. |

---

## 11. Rule-set maintenance (Antigravity + Cursor)

The rules are good and specific; the fixes here are about keeping them **true, consistent and enforceable**.

1. **Fix `.agent/rules/mobile.mdc` frontmatter:** `--------` → `---`, so `description`/`globs` are actually parsed. Rename `yourfile.mdc` → `persona.mdc` and give it frontmatter (or fold it into `mobile.mdc`).
2. **Single source of truth:** keep the canonical rules in one place (e.g. `mobile/docs/rules/` or an `AGENTS.md`) and make the `.agent/` and `.cursor/` files thin pointers or generated copies. Today two sets drift independently (SDK 50 vs 54, 44 vs 48 touch targets).
3. **Update stale rules:**
   - Stack: Expo SDK 54, Expo Router 6, Reanimated 4 (+ worklets), FlashList **v2**, MMKV v4 (`createMMKV`).
   - `list-performance`: remove "always provide `estimatedItemSize`"; document `getItemType`, `FlashListRef`, and the bounded-list exception (P2-6).
   - `code-standards`: "strict mode is enabled" becomes true only after P1-1. If the React Compiler is adopted (P2-9), replace the manual memoisation section.
   - `ui-ux-design`: list the **actual** token names after P2-11; unify touch targets (44 pt iOS / 48 dp Android).
   - Antigravity UI: remove "support Dark Mode automatically" or implement it (P2-12).
   - Data rules: add the **local-first domain data** clause and the ownership table from P2-1, so the "never put data in Zustand" rule stops contradicting the app's design.
   - Add new rules for: date handling (`toDayKey`, never `toISOString` for days), numeric input (`parseDecimal`), error boundaries, and permissions (just-in-time, explainer first).
4. **Enforce rules with tools, not prose:** every rule that can be a lint rule, a TypeScript constraint or a CI check should be one (P1-2, P1-4, P1-9, P2-13). Agents then get the same feedback as humans.

---

## 12. Roadmap

| Phase | Duration (1 dev) | Items | Outcome |
|---|---|---|---|
| **Phase 0 — Stop the bleeding** | ~1 week | P0-1 … P0-7, P1-5 (cleanup), S-2 | Correct days, correct food math, Italian decimals work, language persists |
| **Phase 1 — Foundations** | ~2 weeks | P1-1, P1-2, P1-3 (unit + migrations), P1-4, P1-6, P1-7, P1-8, P1-9, rules §11.1–3 | Green `tsc`/lint/tests in CI; complete EN/IT; error boundaries; protected routes |
| **Phase 2 — Data layer** | ~2–3 weeks | P2-1, P2-2, P2-3, P2-4, P2-5, S-1, S-3 | SQLite-backed histories, Query-backed food API, offline-safe, export/delete data |
| **Phase 3 — Design system, a11y, perf** | ~2–3 weeks | P2-6 … P2-14, A-1 … A-8, §7 UX items | Tokenised UI, accessible controls, virtualised lists, smooth 60 fps on low-end Android |
| **Phase 4 — Ship & grow** | ongoing | P3-1 … P3-4, §10 features (workout sessions first) | EAS pipeline + OTA, crash reporting, store-ready; live workout tracking |

Phases 2 and 3 can run in parallel if two people are working on it. Phase 0 and Phase 1 should not be skipped: the live-workout feature depends on the date, ID, storage and test fixes underneath it.

---

## Appendix A — PR checklist (paste into `.github/pull_request_template.md`)

- [ ] `tsc --noEmit`, `expo lint` and `jest` pass
- [ ] No new hard-coded strings; EN **and** IT keys added
- [ ] No raw hex / arbitrary values; tokens used
- [ ] Icon-only controls have `accessibilityLabel`; targets ≥ 44 pt / 48 dp
- [ ] Persisted shape changed → `version` bumped + `migrate` + migration test
- [ ] Dates use `toDayKey`/`fromDayKey`; numbers use `parseDecimal`/`Intl`
- [ ] Lists of unbounded data use FlashList
- [ ] Timers and listeners cleaned up; no per-frame `setState`
- [ ] Tested on iOS **and** Android (one low-end device for animation work); VoiceOver/TalkBack smoke test for new UI

## Appendix B — Quick wins (≤ 30 min each)

1. Fix `chat.tsx` import path and localise its two strings.
2. Delete `components/TabBar.tsx`.
3. Remove `compatibilityJSON: 'v3'` from `i18n/index.ts`.
4. Remove `estimatedItemSize` from the 6 FlashList call sites; fix the `FlashListRef` type.
5. Rename the package `temp-app` → `spotme`; pin the two `"latest"` dev deps.
6. Remove the microphone permission strings.
7. Remove `ios.deploymentTarget: "15.1"`.
8. Add `accessibilityLabel` to every unlabeled icon-only button (22 icon-only buttons exist; only a few have labels).
9. Replace the hard-coded "Monday, Jan 19" with a formatted date.
10. Fix the Antigravity frontmatter fences.
