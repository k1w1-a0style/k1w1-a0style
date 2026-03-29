#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-}"
WORKFLOW="${2:-}"
REF="${3:-}"

if [[ -z "$REPO" || -z "$WORKFLOW" || -z "$REF" ]]; then
  echo "Usage: $0 <owner/repo> <workflow.yml> <ref>" >&2
  echo "Required env: SUPABASE_URL (or K1W1_SUPABASE_URL), K1W1_EDGE_WORKFLOW_ADMIN_KEY, K1W1_EDGE_WORKFLOW_JWT" >&2
  echo "Auth contract: workflow/build/artifact calls require Authorization: Bearer <jwt> + x-k1w1-admin-key (K1W1_EDGE_WORKFLOW_ADMIN_KEY)." >&2
  exit 2
fi

SUPABASE_BASE="${SUPABASE_URL:-${K1W1_SUPABASE_URL:-}}"
WORKFLOW_ADMIN="${K1W1_EDGE_WORKFLOW_ADMIN_KEY:-}"
WORKFLOW_JWT="${K1W1_EDGE_WORKFLOW_JWT:-}"

if [[ -z "$SUPABASE_BASE" ]]; then
  echo "Missing SUPABASE_URL (or K1W1_SUPABASE_URL)." >&2
  exit 2
fi
if [[ -z "$WORKFLOW_ADMIN" ]]; then
  echo "Missing required K1W1_EDGE_WORKFLOW_ADMIN_KEY (workflow/build/artifact smoke does not accept ADMIN_KEY or K1W1_EDGE_ADMIN_KEY fallback)." >&2
  exit 2
fi
if [[ -z "$WORKFLOW_JWT" ]]; then
  echo "Missing required K1W1_EDGE_WORKFLOW_JWT (workflow/build/artifact smoke requires Authorization: Bearer <jwt> for verify_jwt=true routes)." >&2
  exit 2
fi

edge_post() {
  local route="$1"
  local payload="$2"
  curl -sS "${SUPABASE_BASE}/functions/v1/${route}" \
    -H "content-type: application/json" \
    -H "Authorization: Bearer ${WORKFLOW_JWT}" \
    -H "x-k1w1-admin-key: ${WORKFLOW_ADMIN}" \
    -d "${payload}"
}

dispatch_payload="$(jq -n --arg repo "$REPO" --arg wf "$WORKFLOW" --arg ref "$REF" '{githubRepo:$repo, workflow:$wf, ref:$ref, inputs:{}}')"

echo "Dispatching workflow: repo=$REPO workflow=$WORKFLOW ref=$REF"
dispatch_res="$(edge_post "github-workflow-dispatch" "${dispatch_payload}")"

echo "$dispatch_res" | jq || echo "$dispatch_res"

if [[ "$(echo "$dispatch_res" | jq -r '.ok // false')" != "true" ]]; then
  echo "❌ Dispatch failed" >&2
  exit 1
fi

echo "Fetching latest run..."
run_payload="$(jq -n --arg repo "$REPO" --arg wf "$WORKFLOW" '{githubRepo:$repo, workflow:$wf, limit:1}')"
RUN_ID="$(edge_post "github-workflow-runs" "${run_payload}" | jq -r '.data.workflow_runs[0].id // .workflow_runs[0].id // .runs[0].id // empty')"

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
  meta="$(edge_post "github-workflow-logs" "$(jq -n --arg repo "$REPO" --argjson runId "$RUN_ID" '{githubRepo:$repo, runId:$runId, summary:true}')")"
  status="$(echo "$meta" | jq -r '.run.status // .status // "unknown"')"
  conclusion="$(echo "$meta" | jq -r '.run.conclusion // .conclusion // "unknown"')"
  echo "status=$status conclusion=$conclusion"
  if [[ "$status" == "completed" ]]; then
    break
  fi
  sleep 3
done

echo "Fetching logs summary..."
summary="$(edge_post "github-workflow-logs" "$(jq -n --arg repo "$REPO" --argjson runId "$RUN_ID" '{githubRepo:$repo, runId:$runId, summary:true}')")"
echo "$summary" | jq || echo "$summary"

status="$(echo "$summary" | jq -r '.run.status // .status // "unknown"')"
conclusion="$(echo "$summary" | jq -r '.run.conclusion // .conclusion // "unknown"')"

echo "GitHub truth: status=$status conclusion=$conclusion url=$URL"

if [[ "$status" == "completed" && "$conclusion" != "success" ]]; then
  echo "❌ CI-Lite failed (conclusion=$conclusion)"
  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    echo "---- failing step summary (GitHub API) ----"
    jobs="$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/jobs?per_page=100")" || true
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
