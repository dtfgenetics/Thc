#!/usr/bin/env bash
set -euo pipefail

learning_root="${BACKUP_ROOT:-/tmp/dtf-learning-v3}"
map_root="${LEARNING_V4_BACKUP_ROOT:-/tmp/dtf-learning-v4-final}"
retired_visual_root="${RETIRED_VISUAL_BACKUP_ROOT:-/tmp/dtf-retired-visual-scrub}"
atlas_v3=/tmp/rebuild-wordpress-learning-experience-v3-atlas.mjs
owner_v3=/tmp/rebuild-wordpress-learning-experience-v3-owner-aware.mjs
owner_v4=/tmp/improve-wordpress-learning-v4-owner-aware.mjs
owner_visual=/tmp/apply-learning-visual-v1-owner-aware.mjs

# Learning Experience V3 is the sole Home/Learn WordPress owner. Refuse to
# publish if the independent static Hostinger overlay ever regains /learn/.
if grep -Eq '^[[:space:]]+learn$' scripts/deploy/hostinger-overlay.sh; then
  echo 'Learning ownership violation: static Hostinger overlay contains /learn.' >&2
  exit 1
fi

# The source composer must enforce role-specific visual approval before any
# WordPress mutation happens. Generic Learning slots may never consume strain
# cards or legacy media merely because keywords happen to match.
node --check scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq 'function isApprovedLearningMedia(item)' scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "if (slug.startsWith('dtf-strain-card-')) return false;" scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "slug.startsWith('dtf-approved-visual-')" scripts/prepare-learning-v3-owner-aware-publisher.mjs

# Root owner state is proved through authenticated WordPress storage. Topic and
# child routes still require anonymous visitor verification in their publishers.
# Canonical stored markers remain:
# data-dtf-learning-map="v4"
# data-dtf-learning-expanded-reference="v1"
# Learn the plant as a connected system.
export DTF_REQUIRE_CACHE_CONVERGENCE=true

# Compose the canonical V3 owner in two reviewed, fail-closed passes. The Atlas
# affordance belongs to the base V3 Learn owner and therefore must be present
# before the owner-aware storage/public verification split is applied.
LEARNING_V3_BASE_PUBLISHER="${LEARNING_V3_PUBLISHER_PATH:-scripts/rebuild-wordpress-learning-experience-v3.mjs}" \
LEARNING_V3_ATLAS_PUBLISHER="$atlas_v3" \
node scripts/prepare-learning-v3-atlas-publisher.mjs \
  | tee /tmp/dtf-learning-v3-atlas-prepare.json

LEARNING_V3_SOURCE_PUBLISHER="$atlas_v3" \
LEARNING_V3_OWNER_AWARE_PUBLISHER="$owner_v3" \
node scripts/prepare-learning-v3-owner-aware-publisher.mjs \
  | tee /tmp/dtf-learning-v3-owner-aware-prepare.json

grep -Fq 'function isApprovedLearningMedia(item)' "$owner_v3"
grep -Fq "if (slug.startsWith('dtf-strain-card-')) return false;" "$owner_v3"
grep -Fq 'isApprovedLearningMedia(item) &&' "$owner_v3"

LEARNING_V4_OWNER_AWARE_PUBLISHER="$owner_v4" \
LEARNING_VISUAL_OWNER_AWARE_PUBLISHER="$owner_visual" \
node scripts/prepare-learning-owner-aware-followup-publishers.mjs \
  | tee /tmp/dtf-learning-followup-owner-aware-prepare.json

LEARNING_V3_PUBLISHER_PATH="$owner_v3" \
BACKUP_ROOT="$learning_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/run-learning-v3-production.mjs \
  | tee /tmp/dtf-learning-v3-output.json

LEARNING_OWNER_STAGE=v3 \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-v3-storage.json

APPLY_LEARNING_V4=true \
BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$owner_v4" \
  | tee /tmp/dtf-learning-v4-final-output.json

LEARNING_OWNER_STAGE=v4 \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-v4-storage.json

EXPANDED_REFERENCE_BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/publish-learning-expanded-references-owner-aware.mjs \
  | tee /tmp/dtf-learning-expanded-reference-output.json

LEARNING_OWNER_STAGE=expanded \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-expanded-storage.json

APPLY_LEARNING_VISUAL_V1=true \
BACKUP_ROOT="$map_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs "$owner_visual" \
  | tee /tmp/dtf-learning-visual-v1-output.json

LEARNING_OWNER_STAGE=visual \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/verify-learning-owner-storage.mjs \
  | tee /tmp/dtf-learning-owner-visual-storage.json

# The production transaction cannot complete with retired visual families still
# embedded anywhere in public WordPress content. This runs after all Learning
# writers, so a downstream presentation pass cannot reintroduce quarantined art.
mkdir -p "$retired_visual_root"
APPLY_RETIRED_VISUAL_SCRUB=true \
DELETE_RETIRED_VISUAL_MEDIA=true \
BACKUP_ROOT="$retired_visual_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/scrub-retired-public-visuals.mjs \
  | tee /tmp/dtf-retired-visual-scrub-output.json

# Fail the canonical publish if Home or any core Learning route still renders a
# retired image family. Learning routes additionally fail when an actual image or
# source element contains a strain-card/product-visual identity. Do not scan raw
# CSS class names for this role check: the shared visual stylesheet intentionally
# defines .strain-card rules used by Home, and those selectors are embedded in
# Learn's shared style even when no strain-card image is rendered there.
blocked_visual='(src|srcset|background)[^>]{0,900}(THC[-_ ]?C[0-9]{3}|THC[-_ ]?ENC[-_ ]?[0-9]{3}|Outdoor[-_ ]?[0-9]{2}|Cannabis[_ -]Plant[_ -]Anatomy[_ -]Infographic|Cannabis[_ -]Plant[_ -]Life[_ -]Cycle[_ -]Seed[_ -]to[_ -]Harvest[_ -]Infographic|Cannabis[_ -]Sex[_ -]Expression[_ -]and[_ -]Chromosome[_ -]Combinations|Beneficial[_ -]Insects[_ -]and[_ -]Biological[_ -]Controls|C[0-9]{3}[_ -]Companion)'
blocked_alt="alt=[\"'][^\"']*Teaching[ _-]+Healthy[ _-]+Cultivation"
blocked_learning_media='<(img|source)[^>]{0,1400}(dtf[-_ ]?strain[-_ ]?card|Strain[_ -]Card|DTF[ _-]+Genetics[ _-]+strain[ _-]+card|Mystery[_ -]Line[_ -]F1[_ -]Regular|Rainbow[_ -]Bubblegum[_ -]F1[_ -]Regular)'
verify_routes=(
  /
  /learn/
  /learn/plant-biology/
  /learn/genetics-breeding/
  /learn/lifecycle-propagation/
  /learn/environment-vpd/
  /learn/lighting/
  /learn/water-ph-ec/
  /learn/nutrition-media/
  /learn/ipm/
  /learn/training-canopy/
  /learn/harvest-postharvest/
  /learn/outdoor/
  /learn/research-methods/
  /learn/plant-science-reference/
)
for route in "${verify_routes[@]}"; do
  body="/tmp/dtf-learning-retired-visual-check-$(printf '%s' "$route" | tr '/' '_').html"
  curl -4 --fail --silent --show-error --location --retry 2 --retry-delay 2 \
    -H 'Cache-Control: no-cache, no-store, max-age=0' \
    -H 'Pragma: no-cache' \
    "${WP_SITE_URL:-https://dtfseeds.com}${route}?dtf_learning_visual_gate=${GITHUB_RUN_ID:-local}-$(date +%s%N)" \
    -o "$body"
  if grep -Eqi "$blocked_visual" "$body" || grep -Eqi "$blocked_alt" "$body"; then
    echo "Learning publish still renders a retired visual on $route" >&2
    exit 1
  fi
  if [[ "$route" == /learn/* ]] && grep -Eqi "$blocked_learning_media" "$body"; then
    echo "Learning publish still renders a product/strain-card visual in an educational role on $route" >&2
    exit 1
  fi
done

test -s "$map_root/learning-v4-backup-path.txt"
test -s "$map_root/learning-visual-v1-backup-path.txt"
test -s "$retired_visual_root/retired-visual-scrub-backup-path.txt"
echo "Canonical Learning V3 published with role-safe approved media selection, connected Learning V4 map, expanded THC references, DTF Visual V1, and retired-visual enforcement."
