---
name: 001-review-native-trackers
mode: read-only
effort: high
timeout: 30m
---

# Review: will the Swift modules compile and run correctly?

## Context
SpotMe is an Expo SDK 58 / React Native 0.88 app (new architecture) with local Expo modules written in Swift under `modules/`. Two of them were written without access to a Swift compiler or a device, so they have never been compiled by their author:

- `modules/spotme-motion/ios/SpotmeMotionModule.swift`: reads a video with `AVAssetImageGenerator`, follows user-marked points with Vision (`VNTrackObjectRequest` on a `VNSequenceRequestHandler`) and finds body joints (`VNDetectHumanBodyPoseRequest`). Called from `src/features/motion/runAnalysis.ts` through `modules/spotme-motion/index.ts`.
- `modules/spotme-watch/ios/SpotmeWatchModule.swift`: HealthKit workout mirroring with the watch app in `targets/watch/*.swift`.

Deployment targets: iOS 16.4, watchOS 10. Built with Xcode 27.

## Task
Review these Swift files as a senior iOS engineer who has to make them build and work on the first try. Read the Expo Modules API actually installed (`node_modules/expo-modules-core/ios/`) to check every call against the real signatures, rather than from memory.

Look for, in this order:
1. **Compile errors**: wrong signatures, missing `try`, type mismatches, availability (`@available`) gaps for iOS 16.4, misuse of `Self`, closures the compiler can't infer.
2. **Runtime crashes**: force unwraps, threading (Vision and AVFoundation off the main thread; Expo `Promise` and `sendEvent` from a background queue), missing Info.plist keys or entitlements for what the code calls (compare with `app.json` and `targets/watch/Info.plist`).
3. **Wrong results**: coordinate conversion (Vision's origin is bottom-left; the JS side expects 0–1 from the top-left, see `src/features/motion/analysis/track.ts`), tracker reuse across frames, the JSON shape returned by `analyze` against the `Track` type, time stamps.
4. **Launch-time problems**: anything in either module (or in `targets/watch`) that runs at app start and could make the iPhone app close immediately.

## Files
- Read: the files above, `modules/*/ios/*.podspec`, `modules/*/expo-module.config.json`, `modules/*/index.ts`, `app.json`, `targets/watch/`.
- Do not modify any file.

## Rules
- Do not read or print `.env*` files.
- Only report what you verified in the code. Mark anything you're unsure of as "unverified" and say what would confirm it.

## Final message
A markdown report, most severe first:

| Severity (blocker / bug / risk) | File:line | What's wrong | Evidence (the signature or doc you checked) | Suggested fix (code) |

Then a short section "Checked and fine" listing what you verified is correct, so it isn't re-reviewed.
