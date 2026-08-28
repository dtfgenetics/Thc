#!/usr/bin/env bash
set -euo pipefail

workflow="${1:?workflow file/name required}"
shift || true
mode="dispatch"
if [[ "${1:-}" == "--join-existing" ]]; then
  mode="join-existing"
  shift
elif [[ "${1:-}" == "--join-only" ]]; then
  mode="join-only"
  shift
fi

expected_sha="${EXPECTED_SOURCE_SHA:-${GITHUB_SHA:-}}"
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

find_same_sha_run() {
  gh run list --workflow "$workflow" --branch main --limit 30 \
    --json databaseId,createdAt,headSha,status,conclusion,event \
    | jq -r --arg sha "$expected_sha" '
        [ .[] | select(($sha == "") or (.headSha == $sha)) ]
        | sort_by(.createdAt)
        | last
        | .databaseId // empty
      '
}

run_id=""
if [[ "$mode" == "join-existing" ]]; then
  run_id="$(find_same_sha_run)"
  if [[ -n "$run_id" ]]; then
    echo "Joining existing $workflow run $run_id for source $expected_sha"
  fi
fi

if [[ "$mode" == "join-only" ]]; then
  for attempt in $(seq 1 60); do
    run_id="$(find_same_sha_run)"
    [[ -n "$run_id" ]] && break
    sleep 2
  done
  if [[ -z "$run_id" ]]; then
    echo "No same-source run appeared for required workflow $workflow at $expected_sha" >&2
    exit 2
  fi
  echo "Joining required downstream $workflow run $run_id for source $expected_sha"
elif [[ -z "$run_id" ]]; then
  echo "Dispatching $workflow from main at $started"
  gh workflow run "$workflow" --ref main "$@"

  for attempt in $(seq 1 30); do
    runs="$(gh run list --workflow "$workflow" --branch main --event workflow_dispatch --limit 20 --json databaseId,createdAt,headSha,status,conclusion)"
    run_id="$(jq -r --arg started "$started" --arg sha "$expected_sha" '
      [ .[] | select(.createdAt >= $started) | select(($sha == "") or (.headSha == $sha)) ]
      | sort_by(.createdAt) | last | .databaseId // empty
    ' <<<"$runs")"
    [[ -n "$run_id" ]] && break
    sleep 2
  done

  if [[ -z "$run_id" ]]; then
    echo "Could not identify the workflow_dispatch run for $workflow at expected source $expected_sha" >&2
    exit 2
  fi
fi

echo "Child workflow run: $run_id"
set +e
gh run watch "$run_id" --exit-status
watch_status=$?
set -e

if [[ "$watch_status" -eq 0 ]]; then
  echo "$run_id"
  exit 0
fi

# A status/reporting outage must never turn a successful publication into a failed release.
# Only tolerate a failed child when every failed step is clearly advisory reporting/summary work.
details="$(gh run view "$run_id" --json jobs)"
critical_failures="$(jq '[
  .jobs[].steps[]?
  | select(.conclusion == "failure")
  | select((.name | ascii_downcase | test("report|comment|summary|ledger|notification")) | not)
] | length' <<<"$details")"
report_failures="$(jq '[
  .jobs[].steps[]?
  | select(.conclusion == "failure")
  | select(.name | ascii_downcase | test("report|comment|summary|ledger|notification"))
] | length' <<<"$details")"

if [[ "$critical_failures" -eq 0 && "$report_failures" -gt 0 ]]; then
  echo "Child workflow failed only in advisory reporting; publication result will be decided by gateway live verification."
  echo "$run_id"
  exit 0
fi

echo "Child workflow $workflow had $critical_failures critical failed step(s); refusing to mask the failure." >&2
gh run view "$run_id" --log-failed || true
exit 1
