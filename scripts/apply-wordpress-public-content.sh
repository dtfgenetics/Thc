#!/usr/bin/env bash
set -euo pipefail

: "${WORDPRESS_PATH:?WORDPRESS_PATH is required}"
: "${CONTENT_DIR:?CONTENT_DIR is required}"

WP_BIN="${WP_BIN:-wp}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/dtfseeds-wordpress-backups}"
BACKUP_DIR="$BACKUP_ROOT/public-content-$TIMESTAMP"
REPORT_FILE="$BACKUP_DIR/deployment-report.txt"

mkdir -p "$BACKUP_DIR/pages"
exec > >(tee -a "$REPORT_FILE") 2>&1

echo "DTFSeeds WordPress public-content cleanup"
echo "Timestamp: $TIMESTAMP"
echo "WordPress path: $WORDPRESS_PATH"
echo "Content directory: $CONTENT_DIR"
echo "Backup directory: $BACKUP_DIR"
echo

command -v "$WP_BIN" >/dev/null
[[ -f "$WORDPRESS_PATH/wp-config.php" ]]
[[ -d "$CONTENT_DIR" ]]

required_files=(home games high-iq seeds learn community shop gallery about contact)
for slug in "${required_files[@]}"; do
  file="$CONTENT_DIR/$slug.html"
  [[ -s "$file" ]] || { echo "Missing or empty content file: $file"; exit 1; }
done

for forbidden in \
  "being rebuilt" \
  "Reserved strain card" \
  "Add verified" \
  "Needed from owner" \
  "Tool-ready rebuild" \
  "Use this page for" \
  "staged for"; do
  if grep -RFiq -- "$forbidden" "$CONTENT_DIR"; then
    echo "Forbidden staging phrase found in public content: $forbidden"
    exit 1
  fi
done

echo "Creating database backup before any mutation..."
"$WP_BIN" --path="$WORDPRESS_PATH" db export "$BACKUP_DIR/database.sql" --add-drop-table
"$WP_BIN" --path="$WORDPRESS_PATH" option get home > "$BACKUP_DIR/home-url.txt"
"$WP_BIN" --path="$WORDPRESS_PATH" option get siteurl > "$BACKUP_DIR/site-url.txt"
"$WP_BIN" --path="$WORDPRESS_PATH" option get page_for_posts > "$BACKUP_DIR/page-for-posts.txt" || true
"$WP_BIN" --path="$WORDPRESS_PATH" post list --post_type=page --fields=ID,post_name,post_title,post_status,post_modified_gmt --format=json > "$BACKUP_DIR/pages-index.json"
"$WP_BIN" --path="$WORDPRESS_PATH" post list --post_type=post --fields=ID,post_name,post_title,post_status,post_modified_gmt --format=json > "$BACKUP_DIR/posts-index.json"

echo "Backup complete. Resolving required pages..."

resolve_page_id() {
  local slug="$1"
  local ids count
  ids="$("$WP_BIN" --path="$WORDPRESS_PATH" post list --post_type=page --name="$slug" --field=ID --format=ids)"
  count="$(wc -w <<<"$ids" | tr -d ' ')"
  if [[ "$count" != "1" ]]; then
    echo "Expected exactly one published page for slug '$slug'; found $count. No page changes have been made."
    exit 1
  fi
  printf '%s' "$ids"
}

page_slugs=(home games high-iq seeds learn community shop gallery about contact)
page_titles=(
  "DTF Genetics | Dream the Future"
  "DTF Game Hub | Original Cannabis Games"
  "High IQ | Cannabis Knowledge Challenge"
  "Seeds / Genetics"
  "Teaching Healthy Cultivation"
  "Community"
  "Shop"
  "Gallery"
  "About DTF Genetics"
  "Contact DTF Genetics"
)

declare -A PAGE_IDS=()
for slug in "${page_slugs[@]}"; do
  PAGE_IDS["$slug"]="$(resolve_page_id "$slug")"
  "$WP_BIN" --path="$WORDPRESS_PATH" post get "${PAGE_IDS[$slug]}" --format=json > "$BACKUP_DIR/pages/$slug.json"
done

echo "All required pages resolved and individually backed up. Applying replacements..."
for i in "${!page_slugs[@]}"; do
  slug="${page_slugs[$i]}"
  title="${page_titles[$i]}"
  id="${PAGE_IDS[$slug]}"
  "$WP_BIN" --path="$WORDPRESS_PATH" post update "$id" "$CONTENT_DIR/$slug.html" \
    --post_title="$title" \
    --post_status=publish \
    --porcelain
  echo "Updated /$slug/ (post ID $id)"
done

# Remove the obsolete public blog only when WordPress confirms that the configured
# posts page is the known /blog/ page. This avoids changing an unrelated archive.
page_for_posts="$("$WP_BIN" --path="$WORDPRESS_PATH" option get page_for_posts 2>/dev/null || echo 0)"
if [[ "$page_for_posts" =~ ^[0-9]+$ ]] && (( page_for_posts > 0 )); then
  posts_page_slug="$("$WP_BIN" --path="$WORDPRESS_PATH" post get "$page_for_posts" --field=post_name 2>/dev/null || true)"
  if [[ "$posts_page_slug" == "blog" ]]; then
    "$WP_BIN" --path="$WORDPRESS_PATH" post get "$page_for_posts" --format=json > "$BACKUP_DIR/pages/blog.json"
    "$WP_BIN" --path="$WORDPRESS_PATH" option update page_for_posts 0
    "$WP_BIN" --path="$WORDPRESS_PATH" post update "$page_for_posts" --post_status=draft --porcelain
    echo "Disabled obsolete /blog/ posts page (post ID $page_for_posts)."
  else
    echo "Configured posts page is not /blog/; legacy blog setting left unchanged."
  fi
else
  echo "No configured posts page found; legacy blog setting left unchanged."
fi

legacy_titles=(
  "Exploring DTF Genetics: A Hub for Cannabis Art and Gardening Tools"
  "Explore DTF Genetics: Your Destination for Cannabis-themed Apparel and Art"
)
for legacy_title in "${legacy_titles[@]}"; do
  candidate_ids="$("$WP_BIN" --path="$WORDPRESS_PATH" post list --post_type=post --s="$legacy_title" --field=ID --format=ids)"
  for post_id in $candidate_ids; do
    actual_title="$("$WP_BIN" --path="$WORDPRESS_PATH" post get "$post_id" --field=post_title)"
    if [[ "$actual_title" == "$legacy_title" ]]; then
      "$WP_BIN" --path="$WORDPRESS_PATH" post get "$post_id" --format=json > "$BACKUP_DIR/legacy-post-$post_id.json"
      "$WP_BIN" --path="$WORDPRESS_PATH" post update "$post_id" --post_status=draft --porcelain
      echo "Drafted obsolete generated post: $legacy_title (post ID $post_id)"
    fi
  done
done

"$WP_BIN" --path="$WORDPRESS_PATH" cache flush || true
"$WP_BIN" --path="$WORDPRESS_PATH" rewrite flush --hard || true

echo
echo "Content cleanup completed."
echo "Rollback source: $BACKUP_DIR/database.sql"
echo "Page-level JSON backups: $BACKUP_DIR/pages"
echo "No game directories, plugins, themes, users, products, orders, or media files were changed."
