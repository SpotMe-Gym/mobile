#!/usr/bin/env bash
# Clean native iOS build + run, with every step logged to logs/ios-run.log.
# Use after native dependency changes (SDK upgrade, new native module).
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
LOG="logs/ios-run.log"
: > "$LOG"
exec > >(tee -a "$LOG") 2>&1

step() { echo; echo "=== [$(date +%H:%M:%S)] $* ==="; }

step "Environment"
echo "branch: $(git branch --show-current)"
echo "xcode-select: $(xcode-select -p)"
xcodebuild -version 2>&1 | head -2
echo "bun: $(bun --version)  node: $(node --version)"
xcrun simctl list devices available 2>&1 | grep -E "iPhone" | head -5

step "Clean JS + native folders"
rm -rf node_modules ios .expo
watchman watch-del-all >/dev/null 2>&1 || true

step "bun install"
bun install || { echo "FAILED: bun install"; exit 1; }

step "expo prebuild (iOS) — regenerates ios/ and runs pod install"
CI=1 npx expo prebuild --clean --platform ios || { echo "FAILED: prebuild"; exit 1; }

step "expo run:ios (build, install, launch, Metro)"
npx expo run:ios --no-build-cache
