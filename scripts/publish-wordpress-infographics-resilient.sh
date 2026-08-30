#!/usr/bin/env bash
set -euo pipefail

max_attempts="${INFOGRAPHIC_TRANSACTION_ATTEMPTS:-4}"
log_root="${RUNNER_TEMP:-/tmp}"
mkdir -p "$log_root"

is_transient_failure() {
  local log="$1"
  grep -Eqi 'ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|fetch failed|UND_ERR_CONNECT_TIMEOUT|socket hang up|HTTP (408|425|429|500|502|503|504)' "$log"
}

for attempt in $(seq 1 "$max_attempts"); do
  log="$log_root/infographic-transaction-attempt-${attempt}.log"
  echo "Canonical infographic transaction attempt ${attempt}/${max_attempts}"

  set +e
  bash scripts/publish-wordpress-infographics-canonical-v2.sh 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  set -e

  if [[ "$status" -eq 0 ]]; then
    exit 0
  fi

  if ! is_transient_failure "$log"; then
    echo "Canonical infographic transaction failed with a non-transient error; not retrying." >&2
    exit "$status"
  fi

  if [[ "$attempt" -eq "$max_attempts" ]]; then
    echo "Canonical infographic transaction exhausted ${max_attempts} transient retries." >&2
    exit "$status"
  fi

  delay=$((attempt * 8))
  echo "Transient WordPress/Hostinger failure detected; retrying in ${delay}s."
  sleep "$delay"
done
