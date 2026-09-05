#!/usr/bin/env bash
set -euo pipefail

output_root="${1:-${RUNNER_TEMP:-/tmp}}"
run_id="${2:-${GITHUB_RUN_ID:-manual}}"
site_url="${WP_SITE_URL:-https://dtfseeds.com}"
root_attempts="${LEARNING_ROOT_CONVERGENCE_ATTEMPTS:-12}"
root_delay_seconds="${LEARNING_ROOT_CONVERGENCE_DELAY_SECONDS:-5}"

mkdir -p "$output_root"

curl_public() {
  local path="$1" output="$2" nonce="$3"
  curl -4 --fail --silent --show-error --location \
    --retry 2 --retry-all-errors --retry-delay 2 \
    --connect-timeout 15 --max-time 60 \
    -H 'Cache-Control: no-cache, no-store, max-age=0' \
    -H 'Pragma: no-cache' \
    "${site_url}${path}?dtf_expansion=${nonce}" -o "$output"
}

verify_child() {
  local route="$1" public_marker="$2" body="$output_root/live-${route}.html"
  curl_public "/learn/${route}/" "$body" "${run_id}-${route}"
  grep -Eqi '<h1([ >])' "$body"
  grep -Fqi 'Teaching Healthy Cultivation' "$body"
  grep -Fqi "$public_marker" "$body"
  ! grep -Fqi 'Mystery_Line_F1_Regular_DTF_Strain_Card' "$body"
  ! grep -Fqi 'Rainbow_Bubblegum_F1_Regular_DTF_Strain_Card' "$body"
}

verify_child plant-health 'Plant Health, IPM'
verify_child cultivation-science 'Cultivation Science Reference Library'
verify_child symptoms 'Visual Symptom Differential Library'
verify_child tools 'Printable Learning Tools'
verify_child sources 'Current sources'

learn="$output_root/live-learn.html"
learn_root_ready() {
  grep -Fqi 'Teaching Healthy Cultivation' "$learn" || return 1
  grep -Fqi 'Learn in a sequence that makes the plant easier to understand.' "$learn" || return 1
  grep -Fqi 'Learn the plant as a connected system.' "$learn" || return 1

  local label
  for label in \
    'Plant Health & IPM' \
    'Cultivation Science' \
    'Symptom Differentials' \
    'Printable Field Tools' \
    'Evidence & Sources'; do
    grep -Fqi "$label" "$learn" || return 1
  done

  local href
  for href in \
    /learn/plant-health/ \
    /learn/cultivation-science/ \
    /learn/symptoms/ \
    /learn/tools/ \
    /learn/sources/; do
    grep -Fq "$href" "$learn" || return 1
  done
}

converged=false
for ((attempt = 1; attempt <= root_attempts; attempt += 1)); do
  if curl_public '/learn/' "$learn" "${run_id}-root-${attempt}" && learn_root_ready; then
    converged=true
    echo "Learn root visitor semantics converged on attempt ${attempt}/${root_attempts}."
    break
  fi
  if (( attempt < root_attempts )); then
    echo "Learn root visitor semantics have not converged on attempt ${attempt}/${root_attempts}; retrying after ${root_delay_seconds}s."
    sleep "$root_delay_seconds"
  fi
done

if [[ "$converged" != 'true' ]]; then
  echo "Learn root visitor semantics did not converge after ${root_attempts} attempts." >&2
  for marker in \
    'Teaching Healthy Cultivation' \
    'Learn in a sequence that makes the plant easier to understand.' \
    'Learn the plant as a connected system.' \
    'Plant Health & IPM' \
    'Cultivation Science' \
    'Symptom Differentials' \
    'Printable Field Tools' \
    'Evidence & Sources' \
    '/learn/plant-health/' \
    '/learn/cultivation-science/' \
    '/learn/symptoms/' \
    '/learn/tools/' \
    '/learn/sources/'; do
    if ! grep -Fqi "$marker" "$learn"; then
      echo "Missing Learn visitor semantic after final attempt: $marker" >&2
    fi
  done
  exit 1
fi

echo 'Learning child routes and Learn root passed strict anonymous visitor verification after bounded cache convergence.'
