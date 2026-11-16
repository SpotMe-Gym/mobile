#!/usr/bin/env bash
# Runs one Antigravity (agy) sub-agent job from a spec file. See docs/AGENT_WORKFLOW.md.
#
#   scripts/agy-job.sh docs/specs/001-name.md
#
# The spec's front matter decides how it runs (effort picks the model, see docs/AGENT_WORKFLOW.md):
#   mode: read-only  → in this folder, sandboxed, nothing is changed
#   mode: write      → in its own git worktree (../.agy-worktrees/<name>) on branch agy/<name>,
#                      so the job can't collide with work in this folder
# Output goes to logs/agy/<name>.log (empty until the job ends: agy prints at the end).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

SPEC="${1:-}"
[ -f "$SPEC" ] || { echo "Usage: scripts/agy-job.sh docs/specs/NNN-name.md"; exit 2; }
command -v agy >/dev/null || { echo "agy not found. Install the Antigravity CLI and run 'agy' once to sign in."; exit 1; }

# Front matter value: `key: value` between the first two --- lines.
meta() { awk -v k="$1" 'NR==1&&$0!="---"{exit} NR>1&&$0=="---"{exit} index($0,k":")==1{sub("^"k":[ \t]*","");sub("[ \t]+#.*$","");print;exit}' "$SPEC"; }
NAME="$(meta name)"; NAME="${NAME:-$(basename "$SPEC" .md)}"
MODE="$(meta mode)"; MODE="${MODE:-read-only}"
EFFORT="$(meta effort)"; EFFORT="${EFFORT:-medium}"
# The model follows the effort the job needs (docs/AGENT_WORKFLOW.md, "Models"); `model:` overrides.
case "$EFFORT" in
  low) DEFAULT_MODEL="Gemini 3.8 Flash (Low)" ;;
  medium) DEFAULT_MODEL="Gemini 3.8 Flash (Medium)" ;;
  high) DEFAULT_MODEL="Gemini 4 Argon (High)" ;;
  max) DEFAULT_MODEL="Gemini 4 Hydrogen (High)" ;;
  *) echo "Unknown effort: $EFFORT (low, medium, high or max)"; exit 2 ;;
esac
MODEL="$(meta model)"; MODEL="${MODEL:-$DEFAULT_MODEL}"
TIMEOUT="$(meta timeout)"; TIMEOUT="${TIMEOUT:-15m}"

# Models get renamed: check before starting rather than after a failed run.
MODELS="$(agy models 2>/dev/null | cut -f2)"
if [ -n "$MODELS" ] && ! grep -qxF "$MODEL" <<<"$MODELS"; then
  echo "Model not available: $MODEL"; echo "Available:"; sed 's/^/  /' <<<"$MODELS"; exit 2
fi

mkdir -p logs/agy
LOG="$ROOT/logs/agy/$NAME.log"
# The spec without its front matter is the whole briefing.
PROMPT="$(awk 'NR==1&&$0=="---"{f=1;next} f&&$0=="---"{f=0;next} !f' "$SPEC")"

if [ "$MODE" = "write" ]; then
  WORK="$(dirname "$ROOT")/.agy-worktrees/$NAME"
  if [ ! -d "$WORK" ]; then
    git worktree add -b "agy/$NAME" "$WORK" HEAD
    # Same dependencies as the main folder, so typecheck and tests run there.
    [ -d node_modules ] && ln -s "$ROOT/node_modules" "$WORK/node_modules"
  fi
  FLAGS=(--dangerously-skip-permissions)
else
  WORK="$ROOT"
  FLAGS=(--dangerously-skip-permissions --sandbox)
  PROMPT="Read-only job: do not create, modify or delete any file.

$PROMPT"
fi

echo "› $NAME ($MODE, effort $EFFORT: $MODEL, up to $TIMEOUT)"
echo "  folder: $WORK"
echo "  log:    $LOG  (stays empty until the job ends)"
# What was already uncommitted, so the read-only check only reports what the job changed.
BEFORE="$(git status --porcelain)"
START=$(date +%s)
set +e
# stdin must be closed or agy waits forever.
( cd "$WORK" && agy -p "$PROMPT" --model "$MODEL" --print-timeout "$TIMEOUT" "${FLAGS[@]}" </dev/null >"$LOG" 2>&1 )
CODE=$?
set -e
ELAPSED=$(( $(date +%s) - START ))
echo "  finished in $(( ELAPSED / 60 )) min, exit $CODE"
# agy exits 0 with a partial (often empty) answer when --print-timeout runs out, so check the clock.
case "$TIMEOUT" in
  *h) LIMIT=$(( ${TIMEOUT%h} * 3600 )) ;;
  *m) LIMIT=$(( ${TIMEOUT%m} * 60 )) ;;
  *s) LIMIT=${TIMEOUT%s} ;;
  *) LIMIT=0 ;;
esac
if [ "$CODE" -eq 0 ] && [ "$LIMIT" -gt 0 ] && [ "$ELAPSED" -ge "$LIMIT" ]; then
  echo "! Hit the $TIMEOUT limit: the answer is partial or empty. Raise timeout: in the spec and run it again."
  CODE=124
fi

if [ "$MODE" = "write" ]; then
  echo; echo "Changes on agy/$NAME (uncommitted, for review):"
  git -C "$WORK" status --short | head -40
else
  CHANGED="$(comm -13 <(echo "$BEFORE" | sort) <(git status --porcelain | sort) | grep -v '^?? logs/' || true)"
  [ -z "$CHANGED" ] || { echo "! A read-only job changed files:"; echo "$CHANGED"; }
fi
exit $CODE
