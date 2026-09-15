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
# WordPress mutation happens. Generic Learning slots and topic related-media
# rails may never consume strain cards or legacy media merely because keywords
# happen to match. Root-owner storage verification must read authenticated edit-
# context raw content first; rendered content is only a fallback because
# WordPress can transform markers.
node --check scripts/prepare-learning-v3-owner-aware-publisher.mjs
node --check scripts/clear-wordpress-home-featured-media.mjs
node --check scripts/verify-public-learning-visual-quarantine.mjs
node --check scripts/install-wordpress-learning-semantic-heading.mjs
test -s site/wordpress/snippets/dtf-learning-semantic-heading.php
grep -Fq 'function isApprovedLearningMedia(item)' scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "if (slug.startsWith('dtf-strain-card-')) return false;" scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "slug.startsWith('dtf-approved-visual-')" scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq 'media.filter(item => item?.source_url && isApprovedLearningMedia(item))' scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "rootStorageRead: 'raw-first'" scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "content?.raw || content?.rendered || ''" scripts/prepare-learning-v3-owner-aware-publisher.mjs
grep -Fq "render_block_core/post-title" site/wordpress/snippets/dtf-learning-semantic-heading.php
grep -Fq 'get_page_uri' site/wordpress/snippets/dtf-learning-semantic-heading.php

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
grep -Fq 'media.filter(item => item?.source_url && isApprovedLearningMedia(item))' "$owner_v3"
grep -Fq "owner: 'wordpress-rest-raw-first'" "$owner_v3"
grep -Fq "content?.raw || content?.rendered || ''" "$owner_v3"

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

# Home/Learn are custom owner-rendered pages, so a stale WordPress featured image
# is not part of their visual design. Clear Home's featured-media channel before
# public verification so the theme cannot render quarantined artwork outside
# content.raw and bypass the content scrubber.
APPLY_HOME_FEATURED_MEDIA_GUARD=true \
HOME_FEATURED_MEDIA_REPORT="$map_root/home-featured-media-guard.json" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/clear-wordpress-home-featured-media.mjs \
  | tee /tmp/dtf-home-featured-media-guard-output.json

# The production transaction cannot complete with retired visual families still
# embedded anywhere in public WordPress content. This runs after all Learning
# writers, so a downstream presentation pass cannot reintroduce quarantined art.
mkdir -p "$retired_visual_root"
APPLY_RETIRED_VISUAL_SCRUB=true \
DELETE_RETIRED_VISUAL_MEDIA=true \
BACKUP_ROOT="$retired_visual_root" \
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/scrub-retired-public-visuals.mjs \
  | tee /tmp/dtf-retired-visual-scrub-output.json

# The WordPress title remains stored for admin, SEO and document-title use. The
# source-controlled render owner removes only the block-theme post-title on
# /learn/* pages whose body already owns an H1. Installation uses the same
# authenticated Code Snippets API already authorized for production and fails
# closed if that owner cannot be verified exactly.
node --import ./scripts/wordpress-ipv4-fetch-bootstrap.mjs scripts/install-wordpress-learning-semantic-heading.mjs \
  | tee /tmp/dtf-learning-semantic-heading-output.json

# Verify actual visitor-facing media attributes, not raw stylesheet text. The
# sitewide quarantine CSS intentionally contains selectors like
# img[src*="Cannabis_Plant_Anatomy_Infographic"] so scanning the entire HTML for
# banned strings falsely reports the CSS blocklist itself as a rendered image.
# The verifier strips style/script blocks and inspects real img/source attributes
# plus inline background styles. Learning routes additionally reject product or
# strain-card media in educational roles. Every Learning page must also expose
# exactly one semantic H1 after the theme-title owner is applied.
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
  node scripts/verify-public-learning-visual-quarantine.mjs "$body" "$route"

  if [[ "$route" == /learn/ || "$route" == /learn/* ]]; then
    h1_count="$(node -e "const fs=require('fs');let s=fs.readFileSync(process.argv[1],'utf8');s=s.replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,'').replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi,'').replace(/<!--[\\s\\S]*?-->/g,'');process.stdout.write(String((s.match(/<h1\\b/gi)||[]).length));" "$body")"
    if [[ "$h1_count" != '1' ]]; then
      echo "Learning semantic heading violation on $route: expected exactly one H1, found $h1_count." >&2
      grep -Eoi '<h1\b[^>]*>[^<]{0,180}' "$body" | head -10 >&2 || true
      exit 1
    fi
  fi
done

test -s "$map_root/learning-v4-backup-path.txt"
test -s "$map_root/learning-visual-v1-backup-path.txt"
test -s "$map_root/home-featured-media-guard.json"
test -s "$retired_visual_root/retired-visual-scrub-backup-path.txt"
test -s /tmp/dtf-learning-semantic-heading-output.json
echo "Canonical Learning V3 published with raw-first root storage proof, role-safe approved media selection for hero and related visual references, connected Learning V4 map, expanded THC references, DTF Visual V1, Home featured-media quarantine, rendered-media-only retired-visual enforcement, and exactly one visitor-facing H1 per Learning route."
