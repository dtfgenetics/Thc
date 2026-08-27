#!/usr/bin/env bash
set -euo pipefail

: "${WP_SITE_URL:=https://dtfseeds.com}"
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

mkdir -p "$INFOGRAPHIC_DIR" "$BACKUP_ROOT"

node --check scripts/import-wordpress-infographic-remote-batch.mjs
node --check scripts/stage-eligible-infographics.mjs
node --check scripts/deploy-wordpress-infographic-library-rest.mjs
node --check scripts/publish-wordpress-topic-literature.mjs
node -e "const m=require('./site/wordpress/imports/infographic-bulk-import.json'); if(m.schemaVersion!==1||!Array.isArray(m.assets)) process.exit(1)"
test -n "${WP_API_USERNAME:-}"
test -n "${WP_API_PASSWORD:-}"

echo '== Import queued remote image batch =='
node scripts/import-wordpress-infographic-remote-batch.mjs

# Persist any downloaded source binaries before publication. The current backlog run can be
# empty here; canonical repo assets are still staged and synchronized below.
git config user.name 'DTF Bulk Image Publisher'
git config user.email 'actions@users.noreply.github.com'
git add site/wordpress/assets/infographics
if ! git diff --cached --quiet; then
  git commit -m 'Import queued THC infographic assets'
  git pull --rebase origin main
  git push origin HEAD:main
fi

echo '== Stage finished infographic assets =='
node scripts/stage-eligible-infographics.mjs
QUALITY_REPORT="$BACKUP_ROOT/infographic-quality-gate.json"
test -s "$QUALITY_REPORT"

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

echo '== Synchronize eligible WordPress media =='
node scripts/deploy-wordpress-infographic-library-rest.mjs
MEDIA_BACKUP="$(cat "$BACKUP_ROOT/wordpress-infographic-backup-path.txt")"
MEDIA_REPORT="$MEDIA_BACKUP/deployment-result.json"
test -s "$MEDIA_REPORT"

echo '== Publish topic placements and searchable infographic library =='
node scripts/publish-wordpress-topic-literature.mjs
LITERATURE_BACKUP="$(cat "$BACKUP_ROOT/topic-literature-backup-path.txt")"
LITERATURE_REPORT="$LITERATURE_BACKUP/topic-literature-report.json"
test -s "$LITERATURE_REPORT"

echo '== Verify public website =='
fetch_live() {
  local url="$1"
  local output="$2"
  local marker="$3"
  local ok=0
  for attempt in 1 2 3 4 5 6 7 8; do
    curl -4 --fail --silent --show-error --location --retry 2 --retry-delay 2 \
      --header 'Cache-Control: no-cache, no-store, max-age=0' \
      --header 'Pragma: no-cache' \
      "${url}?dtf_bulk=${GITHUB_RUN_ID:-manual}-${attempt}" --output "$output"
    if grep -Fqi "$marker" "$output"; then
      ok=1
      break
    fi
    sleep 6
  done
  [[ "$ok" -eq 1 ]]
}

LIBRARY_HTML=/tmp/dtfseeds-infographic-library.html
fetch_live 'https://dtfseeds.com/learn/infographics/' "$LIBRARY_HTML" 'Searchable Infographic Library'
grep -Fqi 'thc-infographic-search' "$LIBRARY_HTML"
grep -Eqi '<img[^>]+wp-content/uploads/' "$LIBRARY_HTML"
LIVE_IMAGES="$(grep -Eoi '<img[^>]+wp-content/uploads/' "$LIBRARY_HTML" | wc -l | tr -d ' ')"
test "$LIVE_IMAGES" -ge 20

for route in plant-biology genetics-breeding lifecycle-propagation environment-vpd lighting water-ph-ec nutrition-media ipm training-canopy harvest-postharvest outdoor research-methods plant-science-reference; do
  page="/tmp/dtfseeds-topic-${route}.html"
  fetch_live "https://dtfseeds.com/learn/${route}/" "$page" 'Infographics for'
done

SOURCE_COUNT="$(node -p 'require(process.argv[1]).sourceImageCount' "$QUALITY_REPORT")"
ELIGIBLE_COUNT="$(node -p 'require(process.argv[1]).eligibleImageCount' "$QUALITY_REPORT")"
EXCLUDED_COUNT="$(node -p 'require(process.argv[1]).excludedImageCount' "$QUALITY_REPORT")"
UPLOADED_COUNT="$(node -p 'require(process.argv[1]).uploadedMediaCount' "$MEDIA_REPORT")"
REUSED_COUNT="$(node -p 'require(process.argv[1]).reusedMediaCount' "$MEDIA_REPORT")"
TOPIC_COUNT="$(node -p 'require(process.argv[1]).topicPages.length' "$LITERATURE_REPORT")"
GALLERY_COUNT="$(node -p 'require(process.argv[1]).eligibleInfographics' "$LITERATURE_REPORT")"

cat <<EOF
DTFSEEDS_IMAGE_PUBLISH_RESULT=success
source_images=$SOURCE_COUNT
eligible_images=$ELIGIBLE_COUNT
excluded_images=$EXCLUDED_COUNT
new_wordpress_uploads=$UPLOADED_COUNT
reused_wordpress_media=$REUSED_COUNT
topic_pages=$TOPIC_COUNT
searchable_library_entries=$GALLERY_COUNT
live_library_images=$LIVE_IMAGES
EOF

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat >> "$GITHUB_STEP_SUMMARY" <<EOF
## DTFSeeds bulk image publication

- Source images inspected: **$SOURCE_COUNT**
- Finished eligible images: **$ELIGIBLE_COUNT**
- Excluded support/reference images: **$EXCLUDED_COUNT**
- New WordPress uploads: **$UPLOADED_COUNT**
- Existing WordPress media reused: **$REUSED_COUNT**
- Topic pages synchronized: **$TOPIC_COUNT**
- Searchable library entries: **$GALLERY_COUNT**
- Images observed on public library: **$LIVE_IMAGES**
- Public target: https://dtfseeds.com/learn/infographics/
EOF
fi
