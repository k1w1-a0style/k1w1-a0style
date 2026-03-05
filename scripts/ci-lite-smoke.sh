#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
WORKFLOW="${2:-}"
REF="${3:-main}"

if [[ -z "$REPO" || -z "$WORKFLOW" ]]; then
  echo "Usage: $0 <owner/repo> <workflow.yml> [ref]" >&2
  exit 2
fi

SUPABASE_BASE="${SUPABASE_URL:-${K1W1_SUPABASE_URL:-}}"
ADMIN="${ADMIN_KEY:-${K1W1_EDGE_ADMIN_KEY:-}}"

if [[ -z "$SUPABASE_BASE" ]]; then
  echo "Missing SUPABASE_URL (or K1W1_SUPABASE_URL)." >&2
  exit 2
fi
if [[ -z "$ADMIN" ]]; then
  echo "Missing ADMIN_KEY (or K1W1_EDGE_ADMIN_KEY). Did you run ./scripts/ci-lite-env-load.sh ?" >&2
  exit 2
fi

dispatch_payload="$(jq -n --arg repo "$REPO" --arg wf "$WORKFLOW" --arg ref "$REF" '{githubRepo:$repo, workflow:$wf, ref:$ref, inputs:{}}')"

echo "Dispatching workflow: repo=$REPO workflow=$WORKFLOW ref=$REF"
dispatch_res="$(curl -sS "${SUPABASE_BASE}/functions/v1/github-workflow-dispatch"   -H "content-type: application/json"   -H "x-k1w1-admin-key: ${ADMIN}"   -d "${dispatch_payload}")"

echo "$dispatch_res" | jq || echo "$dispatch_res"

if [[ "$(echo "$dispatch_res" | jq -r '.ok // false')" != "true" ]]; then
  echo "❌ Dispatch failed" >&2
  exit 1
fi

echo "Fetching latest run..."
run_payload="$(jq -n --arg repo "$REPO" --arg wf "$WORKFLOW" '{githubRepo:$repo, workflow:$wf, limit:1}')"
RUN_ID="$(curl -sS "${SUPABASE_BASE}/functions/v1/github-workflow-runs"   -H "content-type: application/json"   -H "x-k1w1-admin-key: ${ADMIN}"   -d "${run_payload}" | jq -r '.runs[0].id // empty')"

if [[ -z "$RUN_ID" ]]; then
  echo "No run id returned yet. Try again in a few seconds."
  exit 1
fi

URL="https://github.com/${REPO}/actions/runs/${RUN_ID}"
echo "RUN_ID=${RUN_ID}"
echo "URL=${URL}"

echo "Polling until completed..."
status="unknown"
conclusion="unknown"
for i in {1..40}; do
  meta="$(curl -sS "${SUPABASE_BASE}/functions/v1/github-workflow-logs"     -H "content-type: application/json"     -H "x-k1w1-admin-key: ${ADMIN}"     -d "$(jq -n --arg repo "$REPO" --argjson runId "$RUN_ID" '{githubRepo:$repo, runId:$runId, summary:true}')" )"
  status="$(echo "$meta" | jq -r '.run.status // .status // "unknown"')"
  conclusion="$(echo "$meta" | jq -r '.run.conclusion // .conclusion // "unknown"')"
  echo "status=$status conclusion=$conclusion"
  if [[ "$status" == "completed" ]]; then
    break
  fi
  sleep 3
done

echo "Fetching logs summary..."
summary="$(curl -sS "${SUPABASE_BASE}/functions/v1/github-workflow-logs"   -H "content-type: application/json"   -H "x-k1w1-admin-key: ${ADMIN}"   -d "$(jq -n --arg repo "$REPO" --argjson runId "$RUN_ID" '{githubRepo:$repo, runId:$runId, summary:true}')" )"
echo "$summary" | jq || echo "$summary"

status="$(echo "$summary" | jq -r '.run.status // .status // "unknown"')"
conclusion="$(echo "$summary" | jq -r '.run.conclusion // .conclusion // "unknown"')"

echo "GitHub truth: status=$status conclusion=$conclusion url=$URL"

if [[ "$status" == "completed" && "$conclusion" != "success" ]]; then
  echo "❌ CI-Lite failed (conclusion=$conclusion)"
  # Optional: print failing job/step summary via GitHub API (needs GITHUB_TOKEN env)
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "---- failing step summary (GitHub API) ----"
    jobs="$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json"       "https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/jobs?per_page=100")" || true
    fail_job="$(echo "$jobs" | jq -r '[.jobs[] | select(.conclusion!="success")][0] // empty')"
    if [[ -n "$fail_job" ]]; then
      echo "$fail_job" | jq -r '"job: " + (.name // "unknown") + " (" + (.conclusion // "unknown") + ")"'
      echo "$fail_job" | jq -r '.steps[] | select(.conclusion!="success") | " - step: " + (.name // "unknown") + " (" + (.conclusion // "unknown") + ")"' | head -n 20
    else
      echo "Could not determine failing job (API response may be rate-limited)."
    fi
    echo "-----------------------------------------"
  else
    echo "Tip: Install GitHub CLI and run: gh run view ${RUN_ID} --log-failed"
  fi
  exit 1
fi

echo "✅ Smoke OK (status=$status conclusion=$conclusion)"
