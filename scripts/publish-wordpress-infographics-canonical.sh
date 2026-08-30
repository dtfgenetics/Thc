#!/usr/bin/env bash
set -euo pipefail

: "${WP_SITE_URL:=https://dtfseeds.com}"
: "${GITHUB_WORKSPACE:=$(pwd)}"
: "${INFOGRAPHIC_SOURCE_DIR:=$GITHUB_WORKSPACE/site/wordpress/assets/infographics}"
: "${INFOGRAPHIC_DIR:=$GITHUB_WORKSPACE/.tmp/eligible-infographics}"
: "${INFOGRAPHIC_PLACEMENT_CONFIG:=$GITHUB_WORKSPACE/site/wordpress/assets/infographics/placement-rules.json}"
: "${INFOGRAPHIC_EXCLUSIONS:=$GITHUB_WORKSPACE/site/wordpress/assets/infographics/infographic-exclusions.json}"
: "${BULK_INFOGRAPHIC_MANIFEST:=$GITHUB_WORKSPACE/site/wordpress/imports/infographic-bulk-import.json}"
: "${BULK_IMPORT_REPORT:=/tmp/infographic-bulk-import-report.json}"
: "${TOPIC_LITERATURE_CONFIG:=$GITHUB_WORKSPACE/site/wordpress/education/topic-literature.json}"
: "${BACKUP_ROOT:=/tmp/wordpress-infographic-backups}"

export WP_SITE_URL INFOGRAPHIC_SOURCE_DIR INFOGRAPHIC_DIR INFOGRAPHIC_PLACEMENT_CONFIG
export INFOGRAPHIC_EXCLUSIONS BULK_INFOGRAPHIC_MANIFEST BULK_IMPORT_REPORT
export TOPIC_LITERATURE_CONFIG BACKUP_ROOT

: "${WP_API_USERNAME:?WP_API_USERNAME is required}"
: "${WP_API_PASSWORD:?WP_API_PASSWORD is required}"
mkdir -p "$INFOGRAPHIC_DIR" "$BACKUP_ROOT"

node --check scripts/import-wordpress-infographic-remote-batch.mjs
node --check scripts/stage-eligible-infographics.mjs
node --check scripts/deploy-wordpress-infographic-library-rest.mjs
node --check scripts/publish-wordpress-topic-literature.mjs
node --check scripts/assemble-outdoor-quantification-v1.mjs
node --check scripts/enhance-wordpress-outdoor-quantification-v1.mjs
node --check scripts/flush-hostinger-litespeed-mcp.mjs
node -e "const m=require('./site/wordpress/imports/infographic-bulk-import.json'); if(m.schemaVersion!==1||!Array.isArray(m.assets)) process.exit(1)"
node -e "const e=require('./site/wordpress/assets/infographics/infographic-exclusions.json'); if(!e.neverUseOnInfographicSurfaces||!e.excludePathFragments?.includes('pdf-pages/')) process.exit(1)"

# Intake is source-only. A failed or expired optional remote source must be
# disabled in the manifest rather than retried forever in production.
node scripts/import-wordpress-infographic-remote-batch.mjs
test -s "$BULK_IMPORT_REPORT"
quarantined="$(node -p 'require(process.argv[1]).quarantined || 0' "$BULK_IMPORT_REPORT")"
requested="$(node -p 'require(process.argv[1]).requestedAssets || 0' "$BULK_IMPORT_REPORT")"
echo "Remote intake: requested=$requested quarantined=$quarantined"

# Persist newly accepted canonical binaries before publishing them.
git config user.name 'DTF Canonical Infographic Publisher'
git config user.email 'actions@users.noreply.github.com'
git add site/wordpress/assets/infographics
if ! git diff --cached --quiet; then
  git commit -m 'Import queued THC infographic assets'
  git pull --rebase origin main
  git push origin HEAD:main
fi

node scripts/stage-eligible-infographics.mjs
QUALITY_REPORT="$BACKUP_ROOT/infographic-quality-gate.json"
test -s "$QUALITY_REPORT"
SOURCE_COUNT="$(node -p 'require(process.argv[1]).sourceImageCount' "$QUALITY_REPORT")"
ELIGIBLE_COUNT="$(node -p 'require(process.argv[1]).eligibleImageCount' "$QUALITY_REPORT")"
EXCLUDED_COUNT="$(node -p 'require(process.argv[1]).excludedImageCount' "$QUALITY_REPORT")"
INVALID_COUNT="$(node -p 'require(process.argv[1]).invalidImageCount || 0' "$QUALITY_REPORT")"
[[ "$INVALID_COUNT" -eq 0 ]] || { echo "Invalid canonical infographic binaries remain: $INVALID_COUNT" >&2; exit 1; }

echo "Quality gate: source=$SOURCE_COUNT eligible=$ELIGIBLE_COUNT excluded=$EXCLUDED_COUNT invalid=$INVALID_COUNT"

if find "$INFOGRAPHIC_DIR" -type f -iname '*.webp' -print -quit | grep -q .; then
  if ! command -v ffmpeg >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo apt-get install -y --no-install-recommends ffmpeg
  fi
  while IFS= read -r -d '' file; do
    output="${file%.*}.png"
    ffmpeg -hide_banner -loglevel error -y -i "$file" -frames:v 1 "$output"
    test -s "$output"
    rm "$file"
  done < <(find "$INFOGRAPHIC_DIR" -type f -iname '*.webp' -print0)
fi

node scripts/deploy-wordpress-infographic-library-rest.mjs
MEDIA_BACKUP="$(cat "$BACKUP_ROOT/wordpress-infographic-backup-path.txt")"
MEDIA_REPORT="$MEDIA_BACKUP/deployment-result.json"
test -s "$MEDIA_REPORT"
WP_MEDIA_COUNT="$(node -p 'require(process.argv[1]).sourceImageCount' "$MEDIA_REPORT")"
[[ "$WP_MEDIA_COUNT" -eq "$ELIGIBLE_COUNT" ]] || {
  echo "Staged/WordPress media mismatch: staged=$ELIGIBLE_COUNT processed=$WP_MEDIA_COUNT" >&2
  exit 1
}

node scripts/publish-wordpress-topic-literature.mjs
LITERATURE_BACKUP="$(cat "$BACKUP_ROOT/topic-literature-backup-path.txt")"
LITERATURE_REPORT="$LITERATURE_BACKUP/topic-literature-report.json"
test -s "$LITERATURE_REPORT"
EXPECTED_CARDS="$(node -p 'require(process.argv[1]).eligibleInfographics' "$LITERATURE_REPORT")"
LIBRARY_PAGE_ID="$(node -p 'require(process.argv[1]).libraryPageId' "$LITERATURE_REPORT")"
TOTAL_EDUCATION_MEDIA="$(node -p 'require(process.argv[1]).totalEducationMedia' "$LITERATURE_REPORT")"
[[ "$EXPECTED_CARDS" -ge 117 ]] || {
  echo "Eligible WordPress infographic set regressed below 117: $EXPECTED_CARDS" >&2
  exit 1
}

echo "WordPress library: page=$LIBRARY_PAGE_ID education_media=$TOTAL_EDUCATION_MEDIA eligible_cards=$EXPECTED_CARDS"

# Outdoor's canonical WordPress route is /learn/outdoor/, not
# /learn/encyclopedia/outdoor/. Publish and verify that exact owner.
OUTDOOR_BACKUP="$BACKUP_ROOT/outdoor-quantification"
mkdir -p "$OUTDOOR_BACKUP"
APPLY_OUTDOOR_QUANT_V1=true BACKUP_ROOT="$OUTDOOR_BACKUP" node scripts/enhance-wordpress-outdoor-quantification-v1.mjs
OUTDOOR_REPORT="$(find "$OUTDOOR_BACKUP" -name report.json -type f -print -quit)"
test -n "$OUTDOOR_REPORT"
node -e "const r=require(process.argv[1]); if(r.route!=='/learn/outdoor/'||r.validation.sections!==8||r.validation.subtopics!==32||r.validation.metrics<100) throw new Error('Outdoor production contract failed')" "$OUTDOOR_REPORT"

# The page cache is part of the transaction. Do not verify visitor state until
# Hostinger/LiteSpeed has acknowledged a full purge.
purge_ok=0
for attempt in 1 2 3; do
  if node scripts/flush-hostinger-litespeed-mcp.mjs; then
    purge_ok=1
    break
  fi
  sleep $((attempt * 4))
done
[[ "$purge_ok" -eq 1 ]] || { echo 'LiteSpeed cache purge failed after retries.' >&2; exit 1; }
sleep 5

fetch_until() {
  local url="$1" output="$2" marker="$3"
  local ok=0
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -4 --fail --silent --show-error --location --retry 2 --retry-delay 2 \
      --connect-timeout 10 --max-time 60 \
      -H 'Cache-Control: no-cache, no-store, max-age=0' \
      -H 'Pragma: no-cache' \
      "${url}?dtf_infographics=${GITHUB_RUN_ID:-manual}-${attempt}-$(date +%s%N)" -o "$output" && \
      grep -Fqi "$marker" "$output"; then
      ok=1
      break
    fi
    sleep 6
  done
  [[ "$ok" -eq 1 ]] || { echo "Visitor route did not converge: $url" >&2; exit 1; }
}

LIBRARY_HTML="${RUNNER_TEMP:-/tmp}/infographic-library.html"
OUTDOOR_HTML="${RUNNER_TEMP:-/tmp}/outdoor.html"
fetch_until "$WP_SITE_URL/learn/infographics/" "$LIBRARY_HTML" 'Searchable Infographic Library'
grep -Eqi '<img[^>]+wp-content/uploads/' "$LIBRARY_HTML"
LIVE_CARDS="$(python3 - "$LIBRARY_HTML" <<'PY'
import pathlib, sys
text = pathlib.Path(sys.argv[1]).read_text(errors='replace')
print(text.count('<article class="thc-visual-card thc-library-card"'))
PY
)"
[[ "$LIVE_CARDS" -eq "$EXPECTED_CARDS" ]] || {
  echo "Expected $EXPECTED_CARDS public infographic cards, found $LIVE_CARDS" >&2
  exit 1
}
[[ "$LIVE_CARDS" -ge 117 ]] || { echo "Public infographic floor regressed below 117: $LIVE_CARDS" >&2; exit 1; }
! grep -Eqi 'THC-ENC-001_VIS-|V04-SUP-|pdf-pages/' "$LIBRARY_HTML" || {
  echo 'Reference-only/support assets leaked into the finished infographic library.' >&2
  exit 1
}

fetch_until "$WP_SITE_URL/learn/outdoor/" "$OUTDOOR_HTML" 'Outdoor'

echo "DTFSEEDS_INFOGRAPHIC_PUBLISH_RESULT=success"
echo "source_images=$SOURCE_COUNT"
echo "eligible_source_images=$ELIGIBLE_COUNT"
echo "excluded_reference_images=$EXCLUDED_COUNT"
echo "wordpress_eligible_cards=$EXPECTED_CARDS"
echo "live_library_cards=$LIVE_CARDS"
echo "library_page_id=$LIBRARY_PAGE_ID"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >> "$GITHUB_STEP_SUMMARY" <<EOF
## Canonical THC infographic publication

- Source images inspected: **$SOURCE_COUNT**
- Full-sheet source images staged: **$ELIGIBLE_COUNT**
- Reference/support images kept off infographic-library surfaces: **$EXCLUDED_COUNT**
- WordPress eligible infographic records: **$EXPECTED_CARDS**
- Visitor-facing library cards after LiteSpeed purge: **$LIVE_CARDS**
- Outdoor canonical route verified: **/learn/outdoor/**
EOF
fi
