## What & why

## Checklist
- [ ] `bun run verify` passes (typecheck, lint, tests, i18n parity)
- [ ] No new hard-coded strings; EN **and** IT keys added
- [ ] No raw hex / arbitrary values; theme tokens used (`theme/colors.ts`, Tailwind tokens)
- [ ] Icon-only controls use `IconButton` (label required); targets ≥ 44 pt / 48 dp
- [ ] Persisted shape changed → `version` bumped + `migrate` + migration test
- [ ] Dates use `toDayKey`/`fromDayKey`; numbers use `parseDecimal`/`formatNumber`
- [ ] Lists of unbounded data use FlashList
- [ ] Timers and listeners cleaned up; no per-frame `setState`
- [ ] Tested on iOS **and** Android; VoiceOver/TalkBack smoke test for new UI
