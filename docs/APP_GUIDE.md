# SpotMe — App Guide

> How the app works today, from the product idea down to individual components. Written 26 Oct 2026 against `chore/expo-sdk-58` (`3d91258`).
> Read [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) first if you need to find a file. [`IMPROVEMENT_PLAN.md`](./IMPROVEMENT_PLAN.md) records what has been fixed.
> §6 (the cards) and §7 (the animation system) are the reference for animation work. §8 lists the animation issues found while writing this.

---

## 1. The idea

SpotMe is a **personal gym and nutrition companion**: one place to plan workouts, log food and track body weight. Four principles drive the design:

| Principle | What it means in the code |
|---|---|
| **The home screen is the app** | There are no tabs. Home is a grid of live cards (weight, today's plan, nutrition, recent activity) plus quick actions. Each card is a small window onto a feature, and tapping it *grows* the card into that feature's full screen. |
| **Spatial continuity** | Navigation should feel like zooming into the card you touched, not jumping to a new page. That's the expandable-card animation (§7.1), the app's signature interaction. |
| **Personal and arrangeable** | Users decide which cards are on home, their order and their size (an iOS-widget-style edit mode, §7.2). |
| **Offline-first and private** | All data lives on the device (MMKV + AsyncStorage). The only network call is the public Open Food Facts database for food search and barcodes. No account, no backend. |

The design is dark-only, high-contrast and iOS-flavoured. It's bilingual (English and Italian) and respects accessibility settings: Dynamic Type, VoiceOver/TalkBack and Reduce Motion.

**On the roadmap** (README): live workout tracking (the "Start workout" button is currently disabled), an AI coach (the ✨ buttons open a "coming soon" screen), body measurements with a 3D body model (prototype in `/Humanoide`), and exercise search.

---

## 2. User journeys

```
First launch ─► Onboarding (3 steps: bio → goals/activity → calorie & macro targets)
                 │  writes profile + first weight entry; the Stack.Protected gate flips to Home
                 ▼
             Home (dashboard grid)
   ┌───────────┬──────────────┼───────────────┬──────────────┬──────────────┐
 tap Body     tap Today's    tap Nutrition   tap Log Meal   tap Add Weight  long-press any card
 Weight card  Plan card      card            (quick action) (quick action)  → edit mode
   │ expands    │ expands      │ expands        │ slides up    │ expands from  (jiggle, drag,
   ▼            ▼              ▼                ▼              │ screen centre  resize, add/remove)
 Body-weight  Today's plan   Nutrition day    Food search    Body-weight + log-weight sheet
 detail       detail         detail            │
                 │              │ "Add to meal" ─┘
                 └► Workouts list ─► Workout editor      Food search ─► Food entry sheet / Quick add
 Avatar ─► Profile ─► Units / Language / Export data / Erase all
```

---

## 3. Screen map (`src/app`)

| Route | File | Presentation | Opened from | Purpose |
|---|---|---|---|---|
| `/onboarding` | `onboarding.tsx` | stack (only route while onboarding is incomplete) | first launch, after "Erase all data" | Profile, goal and targets wizard (react-hook-form + zod) |
| `/` | `index.tsx` | stack root | — | Dashboard grid, greeting, edit mode |
| `/body-weight` | `body-weight/index.tsx` | **expandable card** (`transparentModal`, no native animation) | Body Weight card; Add Weight action (`?add=1`) | Current weight, trend, 7-entry chart, history list, log-weight sheet |
| `/nutrition/detail` | `nutrition/detail.tsx` | **expandable card** | Nutrition card | Today's daily summary (gauge + macro bars) and meals |
| `/workouts/today` | `workouts/today.tsx` | **expandable card** | Today's Plan card | Paged workouts for today plus the active workout's exercises |
| `/nutrition/search` | `nutrition/search.tsx` | `fullScreenModal` (slides up) | Log Meal, "Add to {meal}" | History filtered live; database search on submit; barcode scanner |
| `/nutrition/product/[code]` | `nutrition/product/[code].tsx` | `modal` (page sheet) | search result, barcode, deep link | Serving-first food entry sheet |
| `/nutrition/quick-add` | `nutrition/quick-add.tsx` | `modal` | search, product not found | Manual kcal/macros; optionally saved as a custom food |
| `/workouts` | `workouts/index.tsx` | `fullScreenModal` | today's plan, Assign | Workout library (FlashList), sample plan |
| `/workouts/create` | `workouts/create.tsx` | `fullScreenModal` | library, FAB | Workout editor (field array, schedule days, unsaved guard) |
| `/profile` | `profile/index.tsx` | stack push | avatar on Home | Stats, targets, settings, export/erase |
| `/settings/units`, `/settings/language` | `settings/*.tsx` | stack push | profile | kg/lbs, cm/ft; system/EN/IT |
| `/chat` | `chat.tsx` | `modal` | ✨ buttons | AI coach placeholder |

Root `src/app/_layout.tsx` sets up the providers (gesture handler, safe area, TanStack Query) and the `Stack.Protected` onboarding gate. It also holds the native splash until AsyncStorage stores hydrate, and exports the route `ErrorBoundary`.

---

## 4. Architecture in one page

```
            ┌───────────────────────────── src/app (routes) ─────────────────────────────┐
            │  thin screens: compose feature components, read hooks, navigate            │
            └───────────────┬───────────────────────────────────────────┬────────────────┘
                            ▼                                           ▼
   src/features/<area>: components · hooks · api · utils · store     src/shared: ui · components ·
   (dashboard, nutrition, body-weight, workouts, onboarding, profile)  expandable-card · hooks · lib · utils
                            │                                           │
                            ▼                                           ▼
        Zustand stores (persisted)        TanStack Query (remote)      theme/colors.ts · i18n
        MMKV: user, dashboard             Open Food Facts via
        AsyncStorage: nutrition,          features/nutrition/api
        weight, workouts
```

**State ownership**

| Data | Store (file) | Engine | Key shape |
|---|---|---|---|
| Profile, units, language, targets, onboarding flag | `useUserStore` (`features/profile/userStore.ts`) | MMKV (synchronous) | `UserProfile` + `units` + `language` |
| Home layout | `useDashboardStore` (`features/dashboard/dashboardStore.ts`) | MMKV | `widgets: { id, size }[]` (ordered) |
| Food log + food history | `useNutritionStore` (`features/nutrition/nutritionStore.ts`) | AsyncStorage | `days[YYYY-MM-DD]: LogEntry[]`, `foods[code]: FoodHistoryItem` (per-100 g) |
| Weight log | `useWeightStore` (`features/body-weight/weightStore.ts`) | AsyncStorage | `entries: { id, day, kg, createdAt }[]` sorted |
| Workouts + weekly schedule | `useWorkoutStore` (`features/workouts/workoutStore.ts`) | AsyncStorage | `workouts[]`, `schedule[1..7]: workoutId[]` (ISO weekday) |
| Food database results | TanStack Query (`features/nutrition/hooks/useFood.ts`) | memory cache | `['food','search',…]`, `['food','product',code]` |

Every AsyncStorage-backed screen gates on `useHasHydrated(store)`, so it never shows an "empty" state before data is read.

---

## 5. The home dashboard

**Files:** `src/app/index.tsx` (screen), `features/dashboard/components/DashboardGrid.tsx` (grid and edit logic), `WidgetCell.tsx` (one cell: press, edit, drag, resize, open detail), `widgets/*` (card definitions), `layout/*` (grid maths).

**Grid model** (`layout/widgetSizes.ts`)
- Two columns with a 16 pt gap. `unit = floor((containerWidth − 16) / 2)`.
- Cards: `full` = 2 columns × `unit` high; `half` and `compact` = 1 column × `unit` (square). **`half` and `compact` have identical geometry**; only the content density differs.
- Quick actions are short bars, 56 pt high: `full` spans 2 columns, `half`/`compact` span 1.
- Order and size are persisted in `useDashboardStore.widgets`. The grid is a wrapping flex row, so position comes purely from order and size.

**Widget definition** (`widgets/types.ts`): each card declares
`id · kind (card|action) · category · sizes[] · defaultSize · titleKey · detailPath? · gestureMode (wrapper|inner) · Render`.
- `gestureMode: 'wrapper'`: `WidgetCell` owns the touch (press-scale, tap opens detail, long-press enters edit). The card's own content gets `pointerEvents="none"`.
- `gestureMode: 'inner'`: the card has its own touchables (paging, buttons) and calls the `onPressIn`/`onPressOut`/`onOpenDetail`/`onEnterEdit` callbacks `WidgetCell` passes in.

---

## 6. The cards: purpose, data, behaviour, animation

> **"Data"** lists exactly what each card reads. To change what a card shows, start there.
> **"Preview"** is the component the detail screen renders at the card's closed size while expanding. It is **the same component** as the home card, so closed and open states can't drift.

### 6.1 Body Weight (`bodyWeight`)

| | |
|---|---|
| Goal | At a glance: current weight and whether it's moving toward the user's goal |
| Definition | `features/dashboard/widgets/bodyWeight.tsx` — `kind: card`, `gestureMode: wrapper`, default `full`, `detailPath: '/body-weight'` |
| Content | `features/body-weight/components/BodyWeightCardContent.tsx` (big number, unit, `TrendBadge`) |
| Data | `useUnitConverter()` → `useWeightStore(selectLatestWeight)` + `useUserStore(s => s.units)` · `useWeightTrend()` → latest & previous entry + `useUserStore(s => s.goal)` · `useHasHydrated(useWeightStore)` |
| Tap | Expands to `/body-weight` (preview `WeightCardPreview` in `app/body-weight/index.tsx`) |
| Animations | Press-scale 0.96 spring → expandable card open/close. Edit-mode set (§7.2). Trend colour is static. |
| Animation goal | The big number should look like it *stays* the same number while the card becomes the screen whose header shows that number. |

### 6.2 Today's Plan (`todaysPlan`)

| | |
|---|---|
| Goal | What am I training today? Swipe between multiple workouts scheduled for today. |
| Definition | `widgets/todaysPlan.tsx` — `gestureMode: inner`, default `half`, `detailPath: '/workouts/today'` |
| Content | `features/workouts/components/TodaysPlanCardContent.tsx`. Compact: first workout name. Half/full: horizontal **paging ScrollView**, one page per workout with name, minutes and exercise count, plus a "View plan" button. No workouts: "Rest day" + "Assign" (→ `/workouts`). |
| Data | `useTodaysWorkouts()` → `useWorkoutStore(s => s.schedule)`, `useWorkoutStore(s => s.workouts)`, `useToday()` (ISO weekday, rolls over at midnight), `useHasHydrated(useWorkoutStore)` |
| Tap | Tapping a page (its `Pressable`) or "View plan" expands to `/workouts/today` (preview `WorkoutCardPreview` in `app/workouts/today.tsx`, `pageWidth = cardWidth − 2`). |
| Animations | Press-scale only when pressing the page area (it forwards `onPressIn/Out`); "View plan" has no press-scale. Native ScrollView paging. Expandable open/close. Pager dots are static. |
| Animation goal | The page you're looking at grows into the detail screen's workout carousel. |

### 6.3 Nutrition (`nutrition`)

| | |
|---|---|
| Goal | How much have I eaten today versus my target? |
| Definition | `widgets/nutrition.tsx` — `gestureMode: wrapper`, default `half`, `detailPath: '/nutrition/detail'` |
| Content | `features/nutrition/components/NutritionCardContent.tsx`. Compact: kcal number. Half: segmented `CalorieGauge` (`size="small"`). Full: kcal + three macro chips. |
| Data | `useToday()` → `useDailyTotals(today)` (sums `useNutritionStore(s => s.days[today])`) · `useUserStore(s => s.targets)` · `useHasHydrated(useNutritionStore)` |
| Tap | Expands to `/nutrition/detail` (preview `NutritionCardPreview`) |
| Animations | Press-scale → expandable card. **The gauge and macro bars don't animate**: they render final values instantly. |
| Animation goal | The gauge grows into the detail screen's large gauge ("Daily summary"). |

### 6.4 Recent Activity (`recentActivity`)

| | |
|---|---|
| Goal | The latest things you logged (foods and weigh-ins), newest first |
| Definition | `widgets/recentActivity.tsx` — `gestureMode: wrapper`, default `full`, **no `detailPath`** |
| Data | `useNutritionStore(s => s.days)` (all entries, flattened) · `useWeightStore(s => s.entries)` · `useUnitConverter()` · relative day from `calendarDaysAgo()` + i18n plurals. Count shown: compact 1, half 2, full 3. |
| Tap | Nothing to open, but the press-scale still plays (see §8, issue A8). |

### 6.5 Quick actions (`logMeal`, `addWeight`)

| | |
|---|---|
| Goal | One-tap shortcuts: short bars, not tiles |
| Definition | `widgets/quickActions.tsx` — `kind: action`, `gestureMode: inner`, default `half` |
| Behaviour | A `Button` that calls `router.push`. Log Meal → `/nutrition/search` (native slide-up). Add Weight → `/body-weight?add=1`, which opens the log-weight sheet immediately. |
| Animations | Button pressed opacity only, no press-scale. Add Weight uses the expandable route **without card params**, so the card grows from a centred fallback rectangle while the log-weight sheet fades in at the same time (§8, issue A7). |

---

## 7. The animation system

All motion uses **Reanimated 4** on the UI thread (shared values written with `.set()`, worklet → JS via `scheduleOnRN`) and **Gesture Handler 3**. Reduce Motion is respected via `useReducedMotion()`. Standard timings (`.cursor/rules/animations.mdc`): open 350 ms `out(cubic)`, close 250 ms `inOut(cubic)`, press spring `damping 15 / stiffness 400`.

### 7.1 Expandable card: card → fullscreen

**Files:** `shared/expandable-card/useExpandableNavigation.ts` (home side), `useExpandableCard.ts` (detail side), `ExpandableCardLayout.tsx` (layers), `types.ts` (`CardSize`).

**Step by step**

1. **Press (home):** `handlePressIn` springs `cardScale` to 0.96 and `handlePressOut` back to 1. `WidgetCell` applies it via `animatedStyle.transform.scale`.
2. **Measure & navigate:** `navigateToDetail(route, { widgetSize })`
   - takes a 150 ms global lock against double opens
   - calls `cardRef.measureInWindow` and rebuilds the *unscaled* rect around the measured centre (the card may still be mid press-scale)
   - rounds to whole pixels
   - calls `router.push({ pathname, params: { cardX, cardY, cardWidth, cardHeight, widgetSize } })`
   **These route params are the only channel between the two screens.**
3. **Detail mounts on top:** the route is a `transparentModal` with `animation: 'none'` (`EXPANDABLE` in `_layout.tsx`), so the home screen stays rendered underneath. `ExpandableCardLayoutWithContext` renders three layers:

```
┌ container (flex 1, transparent) ───────────────────────────────────────────┐
│  backdrop  (black, opacity ← progress; tap = close; Android: extends under │
│            the nav bar via Dimensions.get('screen'))                       │
│  card      (absolute, window-sized, overflow hidden, bg = surface,         │
│            transform ← progress: translate + scaleX/scaleY, borderRadius)  │
│    ├ preview  (absoluteFill, centred, counter-scaled 1/scaleX, 1/scaleY;   │
│    │           renders the HOME CARD component at cardWidth×cardHeight)    │
│    └ detail   (flex 1, paddingTop = safe-area top; the full screen)        │
│  bottomFill (Android only: covers the nav-bar strip)                       │
└────────────────────────────────────────────────────────────────────────────┘
```

4. **Geometry** (`useExpandableCard`, from `useWindowDimensions()` = W×H):
   `scaleX = cardWidth/W`, `scaleY = cardHeight/H`,
   `translateX = cardX + cardWidth/2 − W/2`, `translateY = cardY + cardHeight/2 − H/2` (minus the Android `containerOffsetY`).
   At `progress = 0` the full-screen card is shrunk and moved exactly onto the home card. At `1` it is identity.
5. **Timeline** (`progress` 0 → 1 over 350 ms, `Easing.out(cubic)`; close runs 1 → 0 over 250 ms, then `router.back()`):

```
progress    0 ──── 0.35 ──── 0.4 ──── 0.5 ──── 0.65 ──── 0.7 ──────── 1
card        ███ translate/scale/radius interpolate linearly with progress ███
backdrop    0 ─────────────────────────── 0.2 ──────────────────────── 0.7
preview     1 ─────────────────── 1 ════ fades ══════════════ 0 ──────── 0
detail      0 ─────── 0 ════ fades in ════════════ 1 ──────────────────── 1
touches     detail receives touches when progress > 0.5
```

6. **Close:** the header back button, a tap on the backdrop or Android hardware back all call `handleClose()`. It plays the reverse animation (250 ms) and then `router.back()` unmounts the modal, revealing the untouched home card.
7. **Reduce Motion:** opening jumps straight to `progress = 1`, and closing calls `router.back()` with no animation.
8. **Context:** `useExpandableCardContext()` gives detail screens `handleClose`, `cardDimensions` (for the preview size), `progress` and `widgetSize`.

**Intent vs implementation.** `animations.mdc` describes a "blank slate" effect: preview fades out over 0 → 0.15, the card grows empty, then detail fades in over 0.6 → 1. The code instead **cross-fades both layers in the middle** (preview 0.4 → 0.7, detail 0.35 → 0.65). Which one you want is a design decision for the animation work (§8, issue A1).

### 7.2 Dashboard edit mode (`WidgetCell.tsx`, `DashboardGrid.tsx`)

| Interaction | Trigger | Animation | Data / state touched |
|---|---|---|---|
| Enter edit | long-press 400 ms on a card, "Edit layout" button, or the a11y action | Light haptic. Every cell **re-renders as a different element tree** (see A4). Grey 3 pt border, remove badge, resize corner appear instantly. | `isEditing` state in `app/index.tsx` |
| Jiggle | while editing | `rotate` ±1° with `withRepeat(withSequence(timing −1 220 ms, timing +1 220 ms))`, staggered `(index % 3) × 90 ms`. Off under Reduce Motion, while dragging and while resizing. | shared value `rotate` |
| Drag | pan (min 8 pt) on the cell's inner area | `translateX/Y` follow the finger. Scale 1.04 while dragging. Slot raised (`zIndex 30`, `elevation 24`). Page scroll disabled. | `isDragging`, `translateX/Y`. Frames frozen at drag start (`frozenFrames`). |
| Drop – committed | release over a slot covered > 50 % (`layout/dropTarget.ts`) | translate **reset to 0 instantly**, store reorders, `LinearTransition` animates cells to new slots (see A5). Light haptic. | `reorderWidgets(from, to)` |
| Drop – cancelled | not enough coverage | translate springs back to 0 (press spring) | — |
| Resize | pan on edges (48 pt) or corner (56 pt) | Slot `width/height` follow the finger live (clamped to 1–2 columns). On release, `snapSize()` picks the nearest size, the slot snaps, and a haptic fires if it changed. | `previewW/H`, then `setWidgetSize` |
| Layout reflow | any order/size change while not dragging | `layout={LinearTransition}` on the slot (default timing) | — |
| Add card | "+" tile or header + | `AddWidgetSheet`: native `Modal` page sheet, slides up | `addWidget` |
| Remove card | badge or a11y action | Instant removal; neighbours reflow with `LinearTransition` | `removeWidget` |
| Exit edit | Done, tapping empty space | Jiggle cancelled; cells swap back to their normal tree (A4) | — |

### 7.3 Other motion in the app

| Where | What | How |
|---|---|---|
| Stack routes | slide/modal transitions | native-stack defaults (`fullScreenModal`, `modal`, push) |
| `AddWeightModal` | fade in/out | RN `Modal animationType="fade"` |
| `BarcodeScanner` | slide up | RN `Modal animationType="slide"` |
| `AddWidgetSheet` | page sheet | RN `Modal presentationStyle="pageSheet"` |
| `FoodThumb` | image fade-in | `expo-image` `transition={200}` |
| Today's Plan detail | workout pager | native `pagingEnabled` ScrollView; dots update on `onMomentumScrollEnd` |
| Onboarding | step change | **none**: steps swap instantly |
| Gauges, macro bars, weight chart | values | **none**: render final values instantly |
| Haptics | light on edit/reorder/resize/chips; success on save/log | `shared/lib/haptics.ts` |

---

## 8. Animation issues found (input for the fixes)

Each issue has a file reference, ordered by how visible it is.

| # | Issue | Where | Why it looks wrong |
|---|---|---|---|
| **A1** | Fade windows don't match the intended "blank slate"; preview and detail overlap from 0.35 to 0.7 | `useExpandableCard.ts` (`detailContentStyle`, `previewContentStyle`) | Two layers are half-visible at once, which reads as a muddy double image mid-expand |
| **A2** | **Non-uniform scale** distorts content | `containerStyle` scales X and Y independently; the preview counter-scale `1/scaleX, 1/scaleY` is only correct at progress 0 | Mid-animation, preview text is stretched (wide cards) or squashed (square cards). Detail content starts fading in while still distorted. |
| **A3** | Corner radius only compensates X | `borderRadius: cardBorderRadius / scaleX` | With `scaleX ≠ scaleY` the corners become elliptical during the morph and don't match the home card's 16 pt radius at progress 0 |
| **A4** | Edit mode swaps the cell's element type (`AnimatedPressable` ⇄ `Animated.View` tree) | `WidgetCell.tsx` (three return branches) | Every card's content unmounts and remounts on enter/exit edit: a flicker, and inner state is lost (e.g. the Today's Plan pager resets to page 1) |
| **A5** | Committed drop snaps back before sliding | `WidgetCell.tsx` `handleDropJS` sets translate to 0 instantly, then the reorder re-lays out with `LinearTransition` | The card jumps from the finger to its *old* slot, then animates to the new one (likely the "dragging issues" in the history) |
| **A6** | `layoutLocked` flips back in the same render as the reorder | `DashboardGrid.handleDrop` calls `handleDragEnd()` (clears `draggingId`) and `reorderWidgets()` together | Whether `LinearTransition` runs for the drop is timing-dependent |
| **A7** | Add Weight grows from a fake rectangle and stacks two animations | quick action → `/body-weight?add=1` without card params; `AddWeightModal` fades in on mount | The card appears from the screen centre, unrelated to the tapped button, while the sheet fades in on top |
| **A8** | Press feedback without destination | Recent Activity is `wrapper` mode with no `detailPath` | The card shrinks on press but nothing opens |
| **A9** | Inconsistent press feedback inside Today's Plan | `TodaysPlanCardContent`: the page `Pressable` forwards press-in/out; "View plan" doesn't | The same card animates or not depending on where you tap |
| **A10** | `compact` is unreachable by resize gesture | `half` and `compact` have identical geometry; `snapSize` adds a penalty for switching between these twins | Users can only reach `compact` via the accessibility "change size" action |
| **A11** | Drag-handle pill on detail screens without a gesture | `app/{body-weight,nutrition/detail,workouts/today}` show a pill; `gestureEnabled: false` | Looks swipe-to-dismiss, but isn't |
| **A12** | Android first-frame offset | `containerOffsetY` is measured in `onLayout`, after the first animated frame | Possible 1-frame vertical jump at open on Android |
| **A13** | Static data visuals | `CalorieGauge`, `MacroBar`, `WeightChart`, onboarding step swap | No animated fill or transition (polish, not a bug) |

---

## 9. Features in brief

**Nutrition** (`features/nutrition`)
- Search (`app/nutrition/search.tsx`): history filters live; Open Food Facts searches on submit (it rate-limits).
- Barcode → product.
- Food entry sheet (`app/nutrition/product/[code].tsx`):
  - `PortionEditor`: unit tabs serving / g / ml / oz; the amount is kept when switching unit; quick chips; stepper
  - `MacroImpact`: portion macros against today's remaining targets
  - `MealPicker`
- Quick add (`schemas/quickAddSchema.ts`): kcal can come from the macros; can be saved as a custom food.
- Foods are stored **per 100 g**; log entries keep a macro snapshot.

**Body weight** (`features/body-weight`): entries in kg with a local day key. The trend colour depends on the goal (gain is good for "gain muscle"). The chart shows the last 7 entries. The history is a FlashList.

**Workouts** (`features/workouts`): library, editor (field array, reorder ↑↓, rest blocks, two optional execution phases per exercise, ISO-weekday schedule, unsaved-changes guard via `usePreventRemove`) and today's plan.

**Onboarding** (`features/onboarding`): 3 steps validated per step. Targets come from Mifflin-St Jeor × activity + goal offset, split 30/40/30 (`features/nutrition/utils/nutrition.ts`). There's a ratio lock for macros.

**Profile** (`features/profile`): `userStore`, the units converter, data export (share sheet JSON) and erase-everything.

---

## 10. Shared building blocks (`src/shared`)

| Block | Purpose |
|---|---|
| `ui/Button`, `ui/IconButton` | Pressable-based; 44 pt (iOS) / 48 dp (Android) targets. `IconButton` **requires** an accessibility label. |
| `ui/Card`, `ListRow`, `SegmentedControl`, `NumberField`, `Stepper`, `EmptyState`, `Badge`, `Icon` | Design-system primitives; colours only from `theme/colors.ts` |
| `components/ScreenHeader`, `AiButton`, `ErrorFallback` | App-wide composites |
| `expandable-card/*` | §7.1 |
| `hooks/useToday` | Local day key that rolls over at midnight and on app resume |
| `hooks/useHasHydrated` | Wait for a persisted store before rendering its data |
| `lib/*` | MMKV storage adapter, http (typed `ApiError`), queryClient (refetch on foreground), haptics, ids, platform (touch sizes), reporting, `cn` |
| `utils/date`, `number`, `unitConversion` | Local-day keys, ISO weekdays, `calendarDaysAgo`, locale-safe decimal parsing (`72,5`) |

---

## 11. Runtime facts worth knowing

- **Hermes** (React Native's JS engine) lacks some `Intl` APIs. `Intl.RelativeTimeFormat` crashed Recent Activity; ESLint now forbids it. Jest runs on Node and won't catch these.
- **MMKV v4 runs on Nitro Modules.** `react-native-nitro-modules` must be a direct dependency at ≥ 0.36.2 for React Native 0.87+.
- **Xcode 27** replaced Simulator.app with Device Hub. Expo SDK ≥ 56 supports it.
- **After moving files, switching branches or changing dependencies, restart Metro with `bunx expo start -c`.** A running Metro keeps serving the old bundle (e.g. `routerRoot=app` after the move to `src/app`).
- Native dependency changes need `bash scripts/ios-clean-run.sh`.
